import { Router } from "express";
import { getStatus, createCheckout, createPortal, handleWebhook } from "../controllers/billing.controller.js";
import { auth, requireRole } from "../middlewares/auth.js";
import { tenant } from "../middlewares/tenant.js";

const router = Router();

// ─── Webhook — no auth, raw body applied in app.js before express.json() ─────
router.post("/webhook", handleWebhook);

// ─── Protected routes — clinic_admin only ────────────────────────────────────
router.use(auth, tenant, requireRole("clinic_admin"));

router.get("/status", getStatus);
router.post("/checkout", createCheckout);
router.post("/portal", createPortal);

export default router;
