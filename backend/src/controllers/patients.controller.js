import mongoose from "mongoose";
import Patient from "../models/Patient.js";

// ─── helpers ────────────────────────────────────────────────────────────────

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ─── controllers ────────────────────────────────────────────────────────────

/**
 * GET /patients
 * Query params:
 *   - search  (string)  — partial match on name, email or dni
 *   - active  (boolean) — filter by isActive (default: both)
 *   - page    (number)  — 1-based (default: 1)
 *   - limit   (number)  — items per page (default: 20, max: 100)
 */
export const listPatients = async (req, res, next) => {
  try {
    const { search, active, page = 1, limit = 20 } = req.query;

    const filter = { clinicId: req.clinicId };

    if (active !== undefined) {
      filter.isActive = active === "true";
    }

    if (search?.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [{ name: regex }, { email: regex }, { dni: regex }];
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [patients, total] = await Promise.all([
      Patient.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Patient.countDocuments(filter),
    ]);

    return res.json({
      data: patients,
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
 * GET /patients/:id
 */
export const getPatient = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid patient id" });

    const patient = await Patient.findOne({ _id: id, clinicId: req.clinicId });
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    return res.json({ data: patient });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /patients
 * Body: { name, email?, phone?, dni?, notes? }
 */
export const createPatient = async (req, res, next) => {
  try {
    const { name, email, phone, dni, notes } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: "name is required" });
    }

    const patient = await Patient.create({
      clinicId: req.clinicId,
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      dni: dni?.trim() || null,
      notes: notes?.trim() || null,
    });

    return res.status(201).json({ data: patient });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /patients/:id
 * Partial update: { name?, email?, phone?, dni?, notes? }
 */
export const updatePatient = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid patient id" });

    const { name, email, phone, dni, notes } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (email !== undefined) updates.email = email?.trim() || null;
    if (phone !== undefined) updates.phone = phone?.trim() || null;
    if (dni !== undefined) updates.dni = dni?.trim() || null;
    if (notes !== undefined) updates.notes = notes?.trim() || null;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const patient = await Patient.findOneAndUpdate(
      { _id: id, clinicId: req.clinicId },
      { $set: updates },
      { new: true, runValidators: true },
    );

    if (!patient) return res.status(404).json({ message: "Patient not found" });

    return res.json({ data: patient });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /patients/:id/toggle-active
 * Flips isActive without deleting the record.
 */
export const toggleActive = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid patient id" });

    const patient = await Patient.findOne({ _id: id, clinicId: req.clinicId });
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    patient.isActive = !patient.isActive;
    await patient.save();

    return res.json({ data: patient });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /patients/:id
 * Hard delete — only clinic_admin can call this (enforced in routes).
 */
export const deletePatient = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid patient id" });

    const patient = await Patient.findOneAndDelete({ _id: id, clinicId: req.clinicId });
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    return res.json({ message: "Patient deleted" });
  } catch (err) {
    next(err);
  }
};
