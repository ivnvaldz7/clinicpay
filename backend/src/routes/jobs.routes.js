import { Router } from "express";
import { processOverdueInvoices } from "../jobs/overdueInvoices.js";
import { auth, requireRole } from "../middlewares/auth.js";

const router = Router();

/**
 * POST /jobs/run-overdue
 * Manually triggers the overdue invoices job.
 * Restricted to clinic_admin — useful for testing and support.
 */
router.post("/run-overdue", auth, requireRole("clinic_admin"), async (_req, res, next) => {
  try {
    await processOverdueInvoices();
    return res.json({ message: "Overdue job completed" });
  } catch (err) {
    next(err);
  }
});

export default router;
