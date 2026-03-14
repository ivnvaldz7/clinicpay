import Payment from "../models/Payment.js";
import Invoice from "../models/Invoice.js";
import {
  assertInvoiceCanReceivePayment,
  findInvoiceForClinic,
  reconcileInvoice,
} from "../services/invoice.service.js";
import {
  applyDateRange,
  assertEnum,
  assertObjectId,
  assertPositiveNumber,
  normalizeNullableString,
  parsePagination,
} from "../utils/validation.js";

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
      filter.invoiceId = assertObjectId(invoiceId, "invoiceId");
    }

    if (patientId) {
      filter.patientId = assertObjectId(patientId, "patientId");
    }

    if (method) {
      filter.method = assertEnum(method, ["cash", "transfer", "stripe", "mercadopago"], "method");
    }

    applyDateRange(filter, { from, to });

    const { page: pageNum, limit: limitNum, skip } = parsePagination({ page, limit });

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
    assertObjectId(id, "payment id");

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

    assertObjectId(invoiceId, "invoiceId");
    assertPositiveNumber(amount, "amount");
    assertEnum(method, ["cash", "transfer", "stripe", "mercadopago"], "method");

    const invoice = await findInvoiceForClinic(invoiceId, req.clinicId);
    assertInvoiceCanReceivePayment(invoice);

    const payment = await Payment.create({
      clinicId: req.clinicId,
      invoiceId: invoice._id,
      patientId: invoice.patientId,
      amount,
      currency: invoice.currency,
      method,
      notes: normalizeNullableString(notes),
    });

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
    assertObjectId(id, "payment id");

    const payment = await Payment.findOne({ _id: id, clinicId: req.clinicId });
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    const invoice = await Invoice.findOne({ _id: payment.invoiceId, clinicId: req.clinicId });

    await payment.deleteOne();

    if (invoice && invoice.status !== "canceled") {
      await reconcileInvoice(invoice);
    }

    return res.json({ message: "Payment deleted" });
  } catch (err) {
    next(err);
  }
};
