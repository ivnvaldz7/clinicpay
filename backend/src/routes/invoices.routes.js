import { Router } from "express";
import {
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  updateStatus,
  deleteInvoice,
  createPaymentLink,
} from "../controllers/invoices.controller.js";
import { auth, requireRole } from "../middlewares/auth.js";
import { tenant } from "../middlewares/tenant.js";

const router = Router();

// All invoice routes require a valid JWT and tenant context
router.use(auth, tenant);

router.get("/", listInvoices);
router.get("/:id", getInvoice);
router.post("/", createInvoice);
router.patch("/:id", updateInvoice);
router.patch("/:id/status", updateStatus);
router.post("/:id/payment-link", createPaymentLink);

// Hard delete restricted to clinic_admin
router.delete("/:id", requireRole("clinic_admin"), deleteInvoice);

export default router;
