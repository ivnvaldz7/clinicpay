import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10",
});

/**
 * Maps a Stripe Price ID to our internal plan name.
 * Price IDs come from env vars so they can differ per environment.
 */
export const planFromPriceId = (priceId) => {
  if (priceId === process.env.STRIPE_PRICE_BASIC) return "basic";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  return "free";
};

/**
 * Maps a Stripe subscription status to our subscriptionStatus enum.
 */
export const mapSubscriptionStatus = (stripeStatus) => {
  const map = {
    active: "active",
    trialing: "trialing",
    past_due: "past_due",
    canceled: "canceled",
    unpaid: "past_due",
    incomplete: "past_due",
    incomplete_expired: "canceled",
    paused: "past_due",
  };
  return map[stripeStatus] ?? "canceled";
};

/**
 * Returns the existing Stripe customer for a clinic, or creates one.
 * Persists stripeCustomerId back to the clinic document.
 */
export const getOrCreateCustomer = async (clinic) => {
  if (clinic.stripeCustomerId) {
    return stripe.customers.retrieve(clinic.stripeCustomerId);
  }

  const customer = await stripe.customers.create({
    name: clinic.name,
    email: clinic.email,
    metadata: { clinicId: clinic._id.toString() },
  });

  clinic.stripeCustomerId = customer.id;
  await clinic.save();

  return customer;
};
