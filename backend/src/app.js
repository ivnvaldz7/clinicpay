import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.routes.js";
import patientsRoutes from "./routes/patients.routes.js";
import invoicesRoutes from "./routes/invoices.routes.js";
import paymentsRoutes from "./routes/payments.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import jobsRoutes from "./routes/jobs.routes.js";
import billingRoutes from "./routes/billing.routes.js";

const app = express();

// ─── Stripe webhook — needs raw body for signature verification ───────────────
// Must be registered BEFORE express.json() so the body isn't parsed yet.
app.use("/billing/webhook", express.raw({ type: "application/json" }));

// ─── Global middleware ────────────────────────────────────────────────────────

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use("/auth", authRoutes);
app.use("/patients", patientsRoutes);
app.use("/invoices", invoicesRoutes);
app.use("/payments", paymentsRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/jobs", jobsRoutes);
app.use("/billing", billingRoutes);

// ─── Health check ────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ─── Global error handler ────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status ?? 500;
  res.status(status).json({ message: err.message ?? "Internal server error" });
});

export default app;
