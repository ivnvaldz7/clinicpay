import Invoice from "../models/Invoice.js";
import Patient from "../models/Patient.js";
import { stripe } from "../services/stripe.service.js";
import {
  assertInvoiceCanBeEdited,
  findInvoiceForClinic,
  resolveInvoiceTransition,
} from "../services/invoice.service.js";
import {
  applyDateRange,
  assertEnum,
  assertObjectId,
  assertPositiveNumber,
  parsePagination,
} from "../utils/validation.js";

// ─── controllers ────────────────────────────────────────────────────────────

/**
 * GET /invoices
 * Query params:
 *   - patientId (ObjectId)
 *   - status    (pending|paid|overdue|canceled)
 *   - currency  (ARS|USD)
 *   - from      (ISO date) — filter createdAt >=
 *   - to        (ISO date) — filter createdAt <=
 *   - page      (default 1)
 *   - limit     (default 20, max 100)
 */
export const listInvoices = async (req, res, next) => {
  try {
    const { patientId, status, currency, from, to, page = 1, limit = 20 } = req.query;

    const filter = { clinicId: req.clinicId };

    if (patientId) {
      filter.patientId = assertObjectId(patientId, "patientId");
    }

    if (status) {
      filter.status = assertEnum(status, ["pending", "paid", "overdue", "canceled"], "status");
    }

    if (currency) {
      filter.currency = assertEnum(currency, ["ARS", "USD"], "currency");
    }

    applyDateRange(filter, { from, to });

    const { page: pageNum, limit: limitNum, skip } = parsePagination({ page, limit });

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .populate("patientId", "name email dni")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Invoice.countDocuments(filter),
    ]);

    return res.json({
      data: invoices,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /invoices/:id
 */
export const getInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    assertObjectId(id, "invoice id");

    const invoice = await Invoice.findOne({ _id: id, clinicId: req.clinicId })
      .populate("patientId", "name email dni phone")
      .populate("createdBy", "name email");

    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    return res.json({ data: invoice });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /invoices
 * Body: { patientId, concept, amount, currency?, dueDate }
 */
export const createInvoice = async (req, res, next) => {
  try {
    const { patientId, concept, amount, currency, dueDate } = req.body;

    if (!patientId || !concept?.trim() || !amount || !dueDate) {
      return res.status(400).json({ message: "patientId, concept, amount and dueDate are required" });
    }

    assertObjectId(patientId, "patientId");
    assertPositiveNumber(amount, "amount");

    const patient = await Patient.findOne({ _id: patientId, clinicId: req.clinicId });
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    const invoice = await Invoice.create({
      clinicId: req.clinicId,
      patientId,
      createdBy: req.user.userId,
      concept: concept.trim(),
      amount,
      currency: currency ?? "ARS",
      dueDate: new Date(dueDate),
    });

    return res.status(201).json({ data: invoice });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /invoices/:id
 * Editable fields: concept, amount, currency, dueDate.
 * Only allowed when status is "pending".
 */
export const updateInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    assertObjectId(id, "invoice id");

    const invoice = await findInvoiceForClinic(id, req.clinicId);
    assertInvoiceCanBeEdited(invoice);

    const { concept, amount, currency, dueDate } = req.body;

    const updates = {};
    if (concept !== undefined) updates.concept = concept.trim();
    if (amount !== undefined) updates.amount = assertPositiveNumber(amount, "amount");
    if (currency !== undefined) {
      updates.currency = assertEnum(currency, ["ARS", "USD"], "currency");
    }
    if (dueDate !== undefined) updates.dueDate = new Date(dueDate);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    Object.assign(invoice, updates);
    await invoice.save();

    return res.json({ data: invoice });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /invoices/:id/status
 * Body: { status: "paid" | "canceled" | "overdue" }
 * Staff can only mark pending/overdue invoices as paid.
 * clinic_admin can also cancel pending/overdue invoices or mark pending invoices as overdue.
 */
export const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    assertObjectId(id, "invoice id");

    const { status } = req.body;
    assertEnum(status, ["paid", "overdue", "canceled"], "status");

    const invoice = await findInvoiceForClinic(id, req.clinicId);
    resolveInvoiceTransition(invoice, status, req.user.role);

    invoice.status = status;
    if (status === "paid") invoice.paidAt = new Date();
    if (status !== "paid") invoice.paidAt = null;

    await invoice.save();

    return res.json({ data: invoice });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /invoices/:id/payment-link
 * Creates a Stripe Checkout Session for a one-time invoice payment.
 * Returns { url } — does NOT persist the URL (sessions expire in 24 h).
 */
export const createPaymentLink = async (req, res, next) => {
  try {
    const { id } = req.params;
    assertObjectId(id, "invoice id");

    const invoice = await findInvoiceForClinic(id, req.clinicId);

    if (invoice.status === "canceled") {
      return res.status(409).json({ message: "Cannot create a payment link for a canceled invoice" });
    }
    if (invoice.status === "paid") {
      return res.status(409).json({ message: "Invoice is already paid" });
    }

    const stripeCurrency = invoice.currency === "ARS" ? "ars" : invoice.currency.toLowerCase();

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: stripeCurrency,
              unit_amount: Math.round(invoice.amount * 100),
              product_data: { name: invoice.concept },
            },
          },
        ],
        metadata: {
          invoiceId: invoice._id.toString(),
          clinicId: req.clinicId.toString(),
          patientId: invoice.patientId.toString(),
        },
        success_url: `${process.env.CLIENT_ORIGIN}/pay/success?invoiceId=${invoice._id}`,
        cancel_url: `${process.env.CLIENT_ORIGIN}/invoices/${invoice._id}`,
      });

      return res.json({ url: session.url });
    } catch (stripeErr) {
      if (stripeErr.code === "currency_not_supported") {
        return res.status(409).json({
          message: `Stripe does not support charging this invoice in ${invoice.currency} for the current account`,
        });
      }

      throw stripeErr;
    }
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /invoices/:id
 * Hard delete — only clinic_admin, only when status is pending or canceled.
 */
export const deleteInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    assertObjectId(id, "invoice id");

    const invoice = await findInvoiceForClinic(id, req.clinicId);

    if (!["pending", "canceled"].includes(invoice.status)) {
      return res.status(409).json({ message: "Only pending or canceled invoices can be deleted" });
    }

    await invoice.deleteOne();

    return res.json({ message: "Invoice deleted" });
  } catch (err) {
    next(err);
  }
};
