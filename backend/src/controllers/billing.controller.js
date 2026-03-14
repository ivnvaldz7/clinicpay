import Clinic from "../models/Clinic.js";
import Payment from "../models/Payment.js";
import Invoice from "../models/Invoice.js";
import { reconcileInvoice } from "../services/invoice.service.js";
import {
  stripe,
  getOrCreateCustomer,
  planFromPriceId,
  mapSubscriptionStatus,
} from "../services/stripe.service.js";

// ─── protected controllers (clinic_admin only) ───────────────────────────────

/**
 * GET /billing/status
 * Returns the clinic's current plan, subscription status and Stripe IDs.
 */
export const getStatus = async (req, res, next) => {
  try {
    const clinic = await Clinic.findById(req.clinicId).select(
      "name email plan subscriptionStatus stripeCustomerId stripeSubscriptionId trialEndsAt",
    );
    if (!clinic) return res.status(404).json({ message: "Clinic not found" });

    return res.json({ data: clinic });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /billing/checkout
 * Creates a Stripe Checkout session for a new subscription.
 *
 * Body: { priceId }
 *
 * The client redirects to session.url, then Stripe redirects back to
 * successUrl / cancelUrl after the user completes (or abandons) checkout.
 */
export const createCheckout = async (req, res, next) => {
  try {
    const { priceId } = req.body;
    if (!priceId) return res.status(400).json({ message: "priceId is required" });

    const clinic = await Clinic.findById(req.clinicId);
    if (!clinic) return res.status(404).json({ message: "Clinic not found" });

    const customer = await getOrCreateCustomer(clinic);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.CLIENT_ORIGIN}/billing?success=1`,
      cancel_url: `${process.env.CLIENT_ORIGIN}/billing?canceled=1`,
      metadata: { clinicId: clinic._id.toString() },
      subscription_data: {
        metadata: { clinicId: clinic._id.toString() },
      },
    });

    return res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /billing/portal
 * Creates a Stripe Customer Portal session so the clinic admin can manage
 * their subscription (upgrade, downgrade, cancel, update payment method).
 */
export const createPortal = async (req, res, next) => {
  try {
    const clinic = await Clinic.findById(req.clinicId);
    if (!clinic) return res.status(404).json({ message: "Clinic not found" });

    if (!clinic.stripeCustomerId) {
      return res.status(400).json({ message: "No Stripe customer found for this clinic" });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: clinic.stripeCustomerId,
      return_url: `${process.env.CLIENT_ORIGIN}/billing`,
    });

    return res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
};

// ─── webhook (public — verified via Stripe signature) ────────────────────────

/**
 * POST /billing/webhook
 * Receives Stripe events and syncs subscription state to the Clinic document.
 *
 * Handled events:
 *   customer.subscription.created
 *   customer.subscription.updated
 *   customer.subscription.deleted
 *   invoice.payment_failed
 */
export const handleWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,           // raw Buffer — express.raw() is applied in app.js
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("[billing/webhook] Signature verification failed:", err.message);
    return res.status(400).json({ message: `Webhook error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await syncSubscription(event.data.object);
        break;

      case "customer.subscription.deleted":
        await cancelSubscription(event.data.object);
        break;

      case "invoice.payment_failed":
        await markPastDue(event.data.object);
        break;

      case "checkout.session.completed":
        await handleInvoiceCheckoutCompleted(event.data.object);
        break;

      default:
        // Ignore unhandled event types
        break;
    }
  } catch (err) {
    console.error(`[billing/webhook] Error handling ${event.type}:`, err.message);
    // Return 200 to prevent Stripe from retrying on our logic errors
    return res.status(200).json({ received: true, error: err.message });
  }

  return res.json({ received: true });
};

// ─── webhook helpers ─────────────────────────────────────────────────────────

const handleInvoiceCheckoutCompleted = async (session) => {
  // Ignore subscription checkout sessions (no invoiceId in metadata)
  if (!session.metadata?.invoiceId) return;

  const { invoiceId, clinicId, patientId } = session.metadata;
  const paymentIntentId = session.payment_intent;

  // Idempotency guard — skip if already processed
  const existing = await Payment.findOne({ stripePaymentIntentId: paymentIntentId });
  if (existing) {
    console.log(`[billing/webhook] checkout.session.completed already processed: ${paymentIntentId}`);
    return;
  }

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    console.warn(`[billing/webhook] Invoice not found: ${invoiceId}`);
    return;
  }

  await Payment.create({
    clinicId,
    invoiceId,
    patientId,
    amount: session.amount_total / 100,
    currency: invoice.currency,
    method: "stripe",
    stripePaymentIntentId: paymentIntentId,
  });

  await reconcileInvoice(invoice);
  console.log(`[billing/webhook] Invoice ${invoiceId} paid via Stripe checkout`);
};

const findClinicBySubscription = async (subscription) => {
  // Try clinicId from subscription metadata first (most reliable)
  const clinicId = subscription.metadata?.clinicId;
  if (clinicId) {
    const clinic = await Clinic.findById(clinicId);
    if (clinic) return clinic;
  }

  // Fall back to stripeCustomerId
  return Clinic.findOne({ stripeCustomerId: subscription.customer });
};

const syncSubscription = async (subscription) => {
  const clinic = await findClinicBySubscription(subscription);
  if (!clinic) {
    console.warn("[billing/webhook] Clinic not found for subscription:", subscription.id);
    return;
  }

  // Derive plan from the first line item's price
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const plan = planFromPriceId(priceId);

  clinic.stripeSubscriptionId = subscription.id;
  clinic.stripeCustomerId = subscription.customer;
  clinic.plan = plan;
  clinic.subscriptionStatus = mapSubscriptionStatus(subscription.status);
  clinic.trialEndsAt = subscription.trial_end
    ? new Date(subscription.trial_end * 1000)
    : null;

  await clinic.save();
  console.log(`[billing/webhook] Synced clinic ${clinic._id} → plan=${plan}, status=${clinic.subscriptionStatus}`);
};

const cancelSubscription = async (subscription) => {
  const clinic = await findClinicBySubscription(subscription);
  if (!clinic) return;

  clinic.plan = "free";
  clinic.subscriptionStatus = "canceled";
  clinic.stripeSubscriptionId = null;
  await clinic.save();
  console.log(`[billing/webhook] Canceled subscription for clinic ${clinic._id}`);
};

const markPastDue = async (invoice) => {
  if (!invoice.subscription) return;

  const clinic = await Clinic.findOne({ stripeSubscriptionId: invoice.subscription });
  if (!clinic) return;

  clinic.subscriptionStatus = "past_due";
  await clinic.save();
  console.log(`[billing/webhook] Marked past_due for clinic ${clinic._id}`);
};
