import Patient from "../models/Patient.js";
import {
  assertObjectId,
  normalizeNullableString,
  parsePagination,
} from "../utils/validation.js";

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

    const { page: pageNum, limit: limitNum, skip } = parsePagination({ page, limit });

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
    assertObjectId(id, "patient id");

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
      email: normalizeNullableString(email),
      phone: normalizeNullableString(phone),
      dni: normalizeNullableString(dni),
      notes: normalizeNullableString(notes),
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
    assertObjectId(id, "patient id");

    const { name, email, phone, dni, notes } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (email !== undefined) updates.email = normalizeNullableString(email);
    if (phone !== undefined) updates.phone = normalizeNullableString(phone);
    if (dni !== undefined) updates.dni = normalizeNullableString(dni);
    if (notes !== undefined) updates.notes = normalizeNullableString(notes);

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
    assertObjectId(id, "patient id");

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
    assertObjectId(id, "patient id");

    const patient = await Patient.findOneAndDelete({ _id: id, clinicId: req.clinicId });
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    return res.json({ message: "Patient deleted" });
  } catch (err) {
    next(err);
  }
};
