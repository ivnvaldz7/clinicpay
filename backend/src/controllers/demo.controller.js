/**
 * POST /auth/demo
 *
 * Returns a valid session for a pre-seeded demo clinic.
 * If the demo data doesn't exist yet it is created on the fly.
 * Safe to call multiple times — idempotent.
 */
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Clinic from "../models/Clinic.js";
import User from "../models/User.js";
import Patient from "../models/Patient.js";
import Invoice from "../models/Invoice.js";
import Payment from "../models/Payment.js";

// ─── constants ────────────────────────────────────────────────────────────────

const DEMO_EMAIL = "admin@demo.clinicpay";
const DEMO_PASSWORD = "demo1234";

// ─── token helpers (mirrors auth.controller) ─────────────────────────────────

const signAccessToken = (payload) =>
  jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES ?? "15m",
  });

const signRefreshToken = (payload) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES ?? "7d",
  });

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// ─── seed helpers ─────────────────────────────────────────────────────────────

const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);
const daysFromNow = (n) => new Date(Date.now() + n * 86_400_000);

async function seedDemoData() {
  const clinic = await Clinic.create({
    name: "Clínica Demo ClinicPay",
    email: "contacto@demo.clinicpay",
  });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const admin = await User.create({
    clinicId: clinic._id,
    name: "Dr. Sofía Gutiérrez",
    email: DEMO_EMAIL,
    passwordHash,
    role: "clinic_admin",
  });

  // ── Patients ──────────────────────────────────────────────────────────────
  const patients = await Patient.insertMany([
    { clinicId: clinic._id, name: "María López",       email: "maria.lopez@email.com",    phone: "+54 11 4111-1111", isActive: true },
    { clinicId: clinic._id, name: "Juan Rodríguez",    email: "juan.rodriguez@email.com",  phone: "+54 11 4222-2222", isActive: true },
    { clinicId: clinic._id, name: "Carolina Silva",    email: "carolina.silva@email.com",  phone: "+54 11 4333-3333", isActive: true },
    { clinicId: clinic._id, name: "Roberto Fernández", email: "roberto.fern@email.com",    phone: "+54 11 4444-4444", isActive: true },
    { clinicId: clinic._id, name: "Laura Martínez",                                        phone: "+54 11 4555-5555", isActive: true },
  ]);

  const [maria, juan, carolina, roberto, laura] = patients;

  // ── Invoices ──────────────────────────────────────────────────────────────
  const invoicesDefs = [
    // paid — spread across past months for chart data
    { patientId: maria._id,    concept: "Consulta inicial",          amount: 5_000,  dueDate: daysAgo(60), status: "paid" },
    { patientId: juan._id,     concept: "Radiografía panorámica",    amount: 12_000, dueDate: daysAgo(45), status: "paid" },
    { patientId: carolina._id, concept: "Ortodoncia — Cuota 1/12",   amount: 15_000, dueDate: daysAgo(30), status: "paid" },
    { patientId: maria._id,    concept: "Extracción de muela",       amount: 8_000,  dueDate: daysAgo(21), status: "paid" },
    { patientId: roberto._id,  concept: "Blanqueamiento dental",     amount: 22_000, dueDate: daysAgo(90), status: "paid" },
    // pending
    { patientId: carolina._id, concept: "Tratamiento de conducto",   amount: 35_000, dueDate: daysFromNow(15), status: "pending" },
    { patientId: laura._id,    concept: "Limpieza dental",           amount: 4_500,  dueDate: daysFromNow(7),  status: "pending" },
    { patientId: juan._id,     concept: "Ortodoncia — Cuota 2/12",   amount: 15_000, dueDate: daysFromNow(3),  status: "pending" },
    // overdue
    { patientId: roberto._id,  concept: "Control mensual",           amount: 3_500,  dueDate: daysAgo(5),  status: "overdue" },
    { patientId: juan._id,     concept: "Blanqueamiento dental",     amount: 28_000, dueDate: daysAgo(10), status: "overdue" },
  ];

  const invoices = await Invoice.insertMany(
    invoicesDefs.map((inv) => ({ ...inv, clinicId: clinic._id, currency: "ARS" })),
  );

  // ── Payments (for paid invoices, spread across months) ───────────────────
  const paid = invoices.filter((inv) => inv.status === "paid");
  const paymentMethods = ["cash", "transfer", "transfer", "cash", "transfer"];
  const paymentDates = [daysAgo(59), daysAgo(44), daysAgo(29), daysAgo(20), daysAgo(89)];

  await Payment.insertMany(
    paid.map((inv, i) => ({
      clinicId: clinic._id,
      invoiceId: inv._id,
      patientId: inv.patientId,
      amount: inv.amount,
      currency: "ARS",
      method: paymentMethods[i],
      createdAt: paymentDates[i],
      updatedAt: paymentDates[i],
    })),
  );

  console.log("[demo] Seeded demo clinic:", clinic.name);
  return admin;
}

// ─── controller ──────────────────────────────────────────────────────────────

export const demoLogin = async (req, res, next) => {
  try {
    let user = await User.findOne({ email: DEMO_EMAIL });

    if (!user) {
      user = await seedDemoData();
    }

    const payload = {
      userId: user._id,
      clinicId: user.clinicId,
      role: user.role,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);

    return res.json({
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        clinicId: user.clinicId,
      },
    });
  } catch (err) {
    next(err);
  }
};
