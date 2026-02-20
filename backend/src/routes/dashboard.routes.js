import { Router } from "express";
import { getSummary, getRevenue, getOverdue } from "../controllers/dashboard.controller.js";
import { auth } from "../middlewares/auth.js";
import { tenant } from "../middlewares/tenant.js";

const router = Router();

router.use(auth, tenant);

router.get("/summary", getSummary);
router.get("/revenue", getRevenue);
router.get("/overdue", getOverdue);

export default router;
