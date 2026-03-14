import { Router } from "express";
import { processOverdueInvoices } from "../jobs/overdueInvoices.js";
import { auth, requireRole } from "../middlewares/auth.js";
import { tenant } from "../middlewares/tenant.js";
import { checkPlan } from "../middlewares/checkPlan.js";

const router = Router();

/**
 * POST /jobs/run-overdue
 * Manually triggers the overdue invoices job.
 * Restricted to clinic_admin — useful for testing and support.
 */
router.post("/run-overdue", auth, tenant, requireRole("clinic_admin"), checkPlan("basic"), async (req, res, next) => {
  try {
    await processOverdueInvoices({ clinicId: req.clinicId });
    return res.json({ message: "Overdue job completed" });
  } catch (err) {
    next(err);
  }
});

export default router;
