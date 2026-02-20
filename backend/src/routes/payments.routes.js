import { Router } from "express";
import {
  listPayments,
  getPayment,
  createPayment,
  deletePayment,
} from "../controllers/payments.controller.js";
import { auth, requireRole } from "../middlewares/auth.js";
import { tenant } from "../middlewares/tenant.js";

const router = Router();

router.use(auth, tenant);

router.get("/", listPayments);
router.get("/:id", getPayment);
router.post("/", createPayment);

// Deleting a payment reverts invoice status — restricted to clinic_admin
router.delete("/:id", requireRole("clinic_admin"), deletePayment);

export default router;
