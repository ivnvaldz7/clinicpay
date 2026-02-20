import mongoose from "mongoose";
import Invoice from "../models/Invoice.js";
import Patient from "../models/Patient.js";

// ─── helpers ────────────────────────────────────────────────────────────────

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

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
      if (!isValidId(patientId)) return res.status(400).json({ message: "Invalid patientId" });
      filter.patientId = patientId;
    }

    if (status) {
      const valid = ["pending", "paid", "overdue", "canceled"];
      if (!valid.includes(status)) return res.status(400).json({ message: "Invalid status" });
      filter.status = status;
    }

    if (currency) {
      if (!["ARS", "USD"].includes(currency)) return res.status(400).json({ message: "Invalid currency" });
      filter.currency = currency;
    }

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

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
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid invoice id" });

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

    if (!isValidId(patientId)) return res.status(400).json({ message: "Invalid patientId" });

    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ message: "amount must be a positive number" });
    }

    // Ensure patient belongs to this clinic
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
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid invoice id" });

    const invoice = await Invoice.findOne({ _id: id, clinicId: req.clinicId });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    if (invoice.status !== "pending") {
      return res.status(409).json({ message: "Only pending invoices can be edited" });
    }

    const { concept, amount, currency, dueDate } = req.body;

    const updates = {};
    if (concept !== undefined) updates.concept = concept.trim();
    if (amount !== undefined) {
      if (typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ message: "amount must be a positive number" });
      }
      updates.amount = amount;
    }
    if (currency !== undefined) {
      if (!["ARS", "USD"].includes(currency)) return res.status(400).json({ message: "Invalid currency" });
      updates.currency = currency;
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
 * Body: { status: "paid" | "canceled" | "pending" | "overdue" }
 * Only clinic_admin can cancel; staff can mark as paid.
 * Allowed transitions are enforced here.
 */
export const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid invoice id" });

    const { status } = req.body;
    const validStatuses = ["pending", "paid", "overdue", "canceled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const invoice = await Invoice.findOne({ _id: id, clinicId: req.clinicId });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    // Business rules
    if (invoice.status === "canceled") {
      return res.status(409).json({ message: "Canceled invoices cannot be changed" });
    }
    if (status === "canceled" && req.user.role !== "clinic_admin") {
      return res.status(403).json({ message: "Only clinic_admin can cancel invoices" });
    }

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
 * DELETE /invoices/:id
 * Hard delete — only clinic_admin, only when status is pending or canceled.
 */
export const deleteInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid invoice id" });

    const invoice = await Invoice.findOne({ _id: id, clinicId: req.clinicId });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    if (!["pending", "canceled"].includes(invoice.status)) {
      return res.status(409).json({ message: "Only pending or canceled invoices can be deleted" });
    }

    await invoice.deleteOne();

    return res.json({ message: "Invoice deleted" });
  } catch (err) {
    next(err);
  }
};
