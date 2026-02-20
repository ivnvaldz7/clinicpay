import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Invoice from "../models/Invoice.js";

// ─── helpers ────────────────────────────────────────────────────────────────

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Recalculates total paid for an invoice and syncs its status.
 * Called after every payment create or delete.
 */
const reconcileInvoice = async (invoice) => {
  const payments = await Payment.find({ invoiceId: invoice._id });
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  if (totalPaid >= invoice.amount && invoice.status !== "paid") {
    invoice.status = "paid";
    invoice.paidAt = new Date();
  } else if (totalPaid < invoice.amount && invoice.status === "paid") {
    invoice.status = "pending";
    invoice.paidAt = null;
  }

  await invoice.save();
  return invoice;
};

// ─── controllers ────────────────────────────────────────────────────────────

/**
 * GET /payments
 * Query params:
 *   - invoiceId  (ObjectId)
 *   - patientId  (ObjectId)
 *   - method     (cash|transfer|stripe|mercadopago)
 *   - from       (ISO date) — filter createdAt >=
 *   - to         (ISO date) — filter createdAt <=
 *   - page       (default 1)
 *   - limit      (default 20, max 100)
 */
export const listPayments = async (req, res, next) => {
  try {
    const { invoiceId, patientId, method, from, to, page = 1, limit = 20 } = req.query;

    const filter = { clinicId: req.clinicId };

    if (invoiceId) {
      if (!isValidId(invoiceId)) return res.status(400).json({ message: "Invalid invoiceId" });
      filter.invoiceId = invoiceId;
    }

    if (patientId) {
      if (!isValidId(patientId)) return res.status(400).json({ message: "Invalid patientId" });
      filter.patientId = patientId;
    }

    if (method) {
      const valid = ["cash", "transfer", "stripe", "mercadopago"];
      if (!valid.includes(method)) return res.status(400).json({ message: "Invalid method" });
      filter.method = method;
    }

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate("invoiceId", "concept amount currency status dueDate")
        .populate("patientId", "name email dni")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Payment.countDocuments(filter),
    ]);

    return res.json({
      data: payments,
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
 * GET /payments/:id
 */
export const getPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid payment id" });

    const payment = await Payment.findOne({ _id: id, clinicId: req.clinicId })
      .populate("invoiceId", "concept amount currency status dueDate paidAt")
      .populate("patientId", "name email dni phone");

    if (!payment) return res.status(404).json({ message: "Payment not found" });

    return res.json({ data: payment });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /payments
 * Registers a manual payment (cash or transfer) and reconciles the invoice.
 *
 * Body: { invoiceId, amount, method, notes? }
 *
 * - patientId and currency are derived from the invoice (never trusted from body)
 * - After creation, totals are recalculated and invoice status is synced
 */
export const createPayment = async (req, res, next) => {
  try {
    const { invoiceId, amount, method, notes } = req.body;

    if (!invoiceId || amount == null || !method) {
      return res.status(400).json({ message: "invoiceId, amount and method are required" });
    }

    if (!isValidId(invoiceId)) return res.status(400).json({ message: "Invalid invoiceId" });

    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ message: "amount must be a positive number" });
    }

    const validMethods = ["cash", "transfer", "stripe", "mercadopago"];
    if (!validMethods.includes(method)) {
      return res.status(400).json({ message: "Invalid method" });
    }

    // Load invoice and verify ownership
    const invoice = await Invoice.findOne({ _id: invoiceId, clinicId: req.clinicId });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    if (invoice.status === "canceled") {
      return res.status(409).json({ message: "Cannot register a payment on a canceled invoice" });
    }

    if (invoice.status === "paid") {
      return res.status(409).json({ message: "Invoice is already fully paid" });
    }

    // Derive tenant-controlled fields from the invoice
    const payment = await Payment.create({
      clinicId: req.clinicId,
      invoiceId: invoice._id,
      patientId: invoice.patientId,
      amount,
      currency: invoice.currency,
      method,
      notes: notes?.trim() || null,
    });

    // Reconcile invoice status after payment
    await reconcileInvoice(invoice);

    return res.status(201).json({ data: payment });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /payments/:id
 * Hard delete — only clinic_admin.
 * Reconciles the invoice after removal (may revert it from paid → pending).
 */
export const deletePayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid payment id" });

    const payment = await Payment.findOne({ _id: id, clinicId: req.clinicId });
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    const invoice = await Invoice.findOne({ _id: payment.invoiceId, clinicId: req.clinicId });

    await payment.deleteOne();

    // Reconcile if the invoice still exists (may have been deleted separately)
    if (invoice && invoice.status !== "canceled") {
      await reconcileInvoice(invoice);
    }

    return res.json({ message: "Payment deleted" });
  } catch (err) {
    next(err);
  }
};
