import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Stripe from "stripe";

let mongod;
let server;
let baseUrl;
let Clinic;
let User;
let PatientModel;
let InvoiceModel;
let PaymentModel;
let bcrypt;
let originalConsole;

before(async () => {
  originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};

  mongod = await MongoMemoryServer.create();

  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_ACCESS_SECRET = "test_access_secret_32_characters!!";
  process.env.JWT_REFRESH_SECRET = "test_refresh_secret_32_characters!!";
  process.env.JWT_ACCESS_EXPIRES = "15m";
  process.env.JWT_REFRESH_EXPIRES = "7d";
  process.env.CLIENT_ORIGIN = "http://localhost:5173";
  process.env.NODE_ENV = "test";
  process.env.STRIPE_SECRET_KEY = "sk_test_123";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_123";
  process.env.STRIPE_PRICE_BASIC = "price_basic_test";
  process.env.STRIPE_PRICE_PRO = "price_pro_test";

  const [
    { connectDB },
    { default: app },
    clinicModule,
    userModule,
    patientModule,
    invoiceModule,
    paymentModule,
    bcryptModule,
  ] = await Promise.all([
    import("../src/config/db.js"),
    import("../src/app.js"),
    import("../src/models/Clinic.js"),
    import("../src/models/User.js"),
    import("../src/models/Patient.js"),
    import("../src/models/Invoice.js"),
    import("../src/models/Payment.js"),
    import("bcryptjs"),
  ]);

  Clinic = clinicModule.default;
  User = userModule.default;
  PatientModel = patientModule.default;
  InvoiceModel = invoiceModule.default;
  PaymentModel = paymentModule.default;
  bcrypt = bcryptModule.default;

  await connectDB();

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

  await mongoose.disconnect();
  await mongod.stop();

  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

const request = async (path, { method = "GET", body, headers } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));

  return {
    status: response.status,
    body: payload,
    headers: response.headers,
  };
};

const uniqueValue = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const registerClinic = async (prefix) => {
  const slug = uniqueValue(prefix);
  const response = await request("/auth/register", {
    method: "POST",
    body: {
      clinicName: `Clinic ${slug}`,
      clinicEmail: `${slug}@clinic.test`,
      name: `Admin ${slug}`,
      email: `${slug}@user.test`,
      password: "password123",
    },
  });

  assert.equal(response.status, 201);

  return {
    accessToken: response.body.accessToken,
    user: response.body.user,
  };
};

const createPatient = async (token, overrides = {}) => {
  const response = await request("/patients", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: {
      name: uniqueValue("patient"),
      email: `${uniqueValue("patient")}@mail.test`,
      ...overrides,
    },
  });

  assert.equal(response.status, 201);
  return response.body.data;
};

const createInvoice = async (token, patientId, overrides = {}) => {
  const response = await request("/invoices", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: {
      patientId,
      concept: "Consulta",
      amount: 15000,
      dueDate: "2026-12-01T00:00:00.000Z",
      ...overrides,
    },
  });

  assert.equal(response.status, 201);
  return response.body.data;
};

const createStaffForClinic = async (clinicId, email) => {
  const password = "password123";
  const passwordHash = await bcrypt.hash(password, 10);

  await User.create({
    clinicId,
    name: "Staff User",
    email,
    passwordHash,
    role: "staff",
  });

  const loginResponse = await request("/auth/login", {
    method: "POST",
    body: { email, password },
  });

  assert.equal(loginResponse.status, 200);
  return loginResponse.body.accessToken;
};

test("register, refresh and me keep the auth flow working", async () => {
  const registerResponse = await request("/auth/register", {
    method: "POST",
    body: {
      clinicName: "Clinica Test",
      clinicEmail: "clinica@test.com",
      name: "Dra Test",
      email: "admin@test.com",
      password: "password123",
    },
  });

  assert.equal(registerResponse.status, 201);
  assert.equal(registerResponse.body.user.email, "admin@test.com");
  assert.equal(registerResponse.body.user.role, "clinic_admin");
  assert.ok(typeof registerResponse.body.accessToken === "string");

  const cookieHeader = registerResponse.headers.get("set-cookie");
  assert.ok(cookieHeader, "refresh token cookie should be set");

  const refreshResponse = await request("/auth/refresh", {
    method: "POST",
    headers: { Cookie: cookieHeader },
  });

  assert.equal(refreshResponse.status, 200);
  assert.ok(typeof refreshResponse.body.accessToken === "string");

  const meResponse = await request("/auth/me", {
    headers: { Authorization: `Bearer ${refreshResponse.body.accessToken}` },
  });

  assert.equal(meResponse.status, 200);
  assert.equal(meResponse.body.user.email, "admin@test.com");
  assert.equal(meResponse.body.user.passwordHash, undefined);
});

test("login rejects invalid credentials", async () => {
  const response = await request("/auth/login", {
    method: "POST",
    body: {
      email: "admin@test.com",
      password: "wrong-password",
    },
  });

  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Invalid credentials");
});

test("tenant isolation prevents accessing another clinic invoice", async () => {
  const clinicA = await registerClinic("tenant-a");
  const clinicB = await registerClinic("tenant-b");

  const patientA = await createPatient(clinicA.accessToken);
  const invoiceA = await createInvoice(clinicA.accessToken, patientA._id);

  const foreignInvoiceResponse = await request(`/invoices/${invoiceA._id}`, {
    headers: { Authorization: `Bearer ${clinicB.accessToken}` },
  });

  assert.equal(foreignInvoiceResponse.status, 404);

  const foreignPaymentResponse = await request("/payments", {
    method: "POST",
    headers: { Authorization: `Bearer ${clinicB.accessToken}` },
    body: {
      invoiceId: invoiceA._id,
      amount: 15000,
      method: "cash",
    },
  });

  assert.equal(foreignPaymentResponse.status, 404);
});

test("creating a payment reconciles the invoice and blocks manual changes from paid", async () => {
  const clinic = await registerClinic("billing");
  const patient = await createPatient(clinic.accessToken);
  const invoice = await createInvoice(clinic.accessToken, patient._id, { amount: 9000 });

  const paymentResponse = await request("/payments", {
    method: "POST",
    headers: { Authorization: `Bearer ${clinic.accessToken}` },
    body: {
      invoiceId: invoice._id,
      amount: 9000,
      method: "transfer",
    },
  });

  assert.equal(paymentResponse.status, 201);
  assert.equal(paymentResponse.body.data.currency, "ARS");

  const refreshedInvoice = await request(`/invoices/${invoice._id}`, {
    headers: { Authorization: `Bearer ${clinic.accessToken}` },
  });

  assert.equal(refreshedInvoice.status, 200);
  assert.equal(refreshedInvoice.body.data.status, "paid");
  assert.ok(refreshedInvoice.body.data.paidAt);

  const invalidTransitionResponse = await request(`/invoices/${invoice._id}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${clinic.accessToken}` },
    body: { status: "overdue" },
  });

  assert.equal(invalidTransitionResponse.status, 409);
  assert.equal(
    invalidTransitionResponse.body.message,
    "Paid invoices cannot be changed manually",
  );
});

test("overdue job endpoint is gated by plan and updates eligible clinic invoices", async () => {
  const freeClinic = await registerClinic("free-job");
  const paidClinic = await registerClinic("paid-job");

  await Clinic.findByIdAndUpdate(paidClinic.user.clinicId, {
    plan: "basic",
    subscriptionStatus: "active",
  });

  const freePatient = await createPatient(freeClinic.accessToken, { email: null });
  const paidPatient = await createPatient(paidClinic.accessToken, { email: null });

  const freeInvoice = await createInvoice(freeClinic.accessToken, freePatient._id, {
    dueDate: "2025-01-01T00:00:00.000Z",
  });
  const paidInvoice = await createInvoice(paidClinic.accessToken, paidPatient._id, {
    dueDate: "2025-01-01T00:00:00.000Z",
  });

  const blockedRun = await request("/jobs/run-overdue", {
    method: "POST",
    headers: { Authorization: `Bearer ${freeClinic.accessToken}` },
  });

  assert.equal(blockedRun.status, 403);

  const allowedRun = await request("/jobs/run-overdue", {
    method: "POST",
    headers: { Authorization: `Bearer ${paidClinic.accessToken}` },
  });

  assert.equal(allowedRun.status, 200);

  const [freeInvoiceAfter, paidInvoiceAfter] = await Promise.all([
    InvoiceModel.findById(freeInvoice._id),
    InvoiceModel.findById(paidInvoice._id),
  ]);

  assert.equal(freeInvoiceAfter.status, "pending");
  assert.equal(paidInvoiceAfter.status, "overdue");
});

test("billing webhook processes checkout completion idempotently", async () => {
  const clinic = await registerClinic("webhook");
  const patient = await createPatient(clinic.accessToken);
  const invoice = await createInvoice(clinic.accessToken, patient._id, { amount: 12000 });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-04-10" });
  const eventPayload = {
    id: "evt_checkout_completed_1",
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_123",
        object: "checkout.session",
        metadata: {
          invoiceId: invoice._id.toString(),
          clinicId: clinic.user.clinicId,
          patientId: patient._id.toString(),
        },
        payment_intent: "pi_test_123",
        amount_total: 1200000,
      },
    },
  };
  const payload = JSON.stringify(eventPayload);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });

  const firstResponse = await request("/billing/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    body: eventPayload,
  });

  const secondResponse = await request("/billing/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    body: eventPayload,
  });

  assert.equal(firstResponse.status, 200);
  assert.equal(secondResponse.status, 200);

  const payments = await PaymentModel.find({ stripePaymentIntentId: "pi_test_123" });
  const refreshedInvoice = await InvoiceModel.findById(invoice._id);

  assert.equal(payments.length, 1);
  assert.equal(payments[0].amount, 12000);
  assert.equal(refreshedInvoice.status, "paid");
});

test("staff role is blocked from admin-only endpoints", async () => {
  const clinic = await registerClinic("roles");
  const staffToken = await createStaffForClinic(
    clinic.user.clinicId,
    `${uniqueValue("staff")}@user.test`,
  );
  const patient = await createPatient(clinic.accessToken);

  const billingResponse = await request("/billing/status", {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert.equal(billingResponse.status, 403);

  const deletePatientResponse = await request(`/patients/${patient._id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert.equal(deletePatientResponse.status, 403);

  const createInvoiceResponse = await request("/invoices", {
    method: "POST",
    headers: { Authorization: `Bearer ${staffToken}` },
    body: {
      patientId: patient._id,
      concept: "Control",
      amount: 5000,
      dueDate: "2026-12-01T00:00:00.000Z",
    },
  });
  assert.equal(createInvoiceResponse.status, 201);
});

test("dashboard endpoints return summary, revenue and overdue data for the clinic", async () => {
  const clinic = await registerClinic("dashboard");
  const patient = await createPatient(clinic.accessToken, { name: "Paciente Dashboard" });

  const paidInvoice = await createInvoice(clinic.accessToken, patient._id, {
    concept: "Consulta pagada",
    amount: 7000,
    dueDate: "2026-01-10T00:00:00.000Z",
  });
  const overdueInvoice = await createInvoice(clinic.accessToken, patient._id, {
    concept: "Consulta vencida",
    amount: 3000,
    dueDate: "2025-01-01T00:00:00.000Z",
  });

  await request(`/invoices/${paidInvoice._id}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${clinic.accessToken}` },
    body: { status: "paid" },
  });

  await request(`/invoices/${overdueInvoice._id}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${clinic.accessToken}` },
    body: { status: "overdue" },
  });

  await PaymentModel.create({
    clinicId: clinic.user.clinicId,
    invoiceId: paidInvoice._id,
    patientId: patient._id,
    amount: 7000,
    currency: "ARS",
    method: "cash",
    createdAt: new Date("2026-02-15T00:00:00.000Z"),
  });

  const [summaryResponse, revenueResponse, overdueResponse] = await Promise.all([
    request("/dashboard/summary?currency=ARS", {
      headers: { Authorization: `Bearer ${clinic.accessToken}` },
    }),
    request("/dashboard/revenue?from=2026-01-01T00:00:00.000Z&to=2026-12-31T23:59:59.999Z&groupBy=month&currency=ARS", {
      headers: { Authorization: `Bearer ${clinic.accessToken}` },
    }),
    request("/dashboard/overdue?currency=ARS", {
      headers: { Authorization: `Bearer ${clinic.accessToken}` },
    }),
  ]);

  assert.equal(summaryResponse.status, 200);
  assert.equal(summaryResponse.body.data.collected.amount, 7000);
  assert.equal(summaryResponse.body.data.overdue.amount, 3000);
  assert.equal(summaryResponse.body.data.patients.total, 1);

  assert.equal(revenueResponse.status, 200);
  assert.equal(revenueResponse.body.data.length, 1);
  assert.equal(revenueResponse.body.data[0].amount, 7000);

  assert.equal(overdueResponse.status, 200);
  assert.equal(overdueResponse.body.data.length, 1);
  assert.equal(overdueResponse.body.data[0]._id, overdueInvoice._id);
});

test("billing endpoints validate admin access and request preconditions", async () => {
  const clinic = await registerClinic("billing-endpoints");
  const staffToken = await createStaffForClinic(
    clinic.user.clinicId,
    `${uniqueValue("billing-staff")}@user.test`,
  );

  const statusResponse = await request("/billing/status", {
    headers: { Authorization: `Bearer ${clinic.accessToken}` },
  });
  assert.equal(statusResponse.status, 200);
  assert.equal(statusResponse.body.data.plan, "free");

  const checkoutValidationResponse = await request("/billing/checkout", {
    method: "POST",
    headers: { Authorization: `Bearer ${clinic.accessToken}` },
    body: {},
  });
  assert.equal(checkoutValidationResponse.status, 400);
  assert.equal(checkoutValidationResponse.body.message, "priceId is required");

  const portalValidationResponse = await request("/billing/portal", {
    method: "POST",
    headers: { Authorization: `Bearer ${clinic.accessToken}` },
  });
  assert.equal(portalValidationResponse.status, 400);
  assert.equal(portalValidationResponse.body.message, "No Stripe customer found for this clinic");

  const staffStatusResponse = await request("/billing/status", {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert.equal(staffStatusResponse.status, 403);
});
