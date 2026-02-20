import { Router } from "express";
import {
  listPatients,
  getPatient,
  createPatient,
  updatePatient,
  toggleActive,
  deletePatient,
} from "../controllers/patients.controller.js";
import { auth } from "../middlewares/auth.js";
import { tenant } from "../middlewares/tenant.js";
import { requireRole } from "../middlewares/auth.js";

const router = Router();

// All patients routes require a valid JWT and tenant context
router.use(auth, tenant);

router.get("/", listPatients);
router.get("/:id", getPatient);
router.post("/", createPatient);
router.patch("/:id", updatePatient);
router.patch("/:id/toggle-active", toggleActive);

// Hard delete restricted to clinic_admin
router.delete("/:id", requireRole("clinic_admin"), deletePatient);

export default router;
