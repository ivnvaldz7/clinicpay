import { Router } from "express";
import { register, login, refresh, logout, me } from "../controllers/auth.controller.js";
import { auth } from "../middlewares/auth.js";

const router = Router();

// Public
router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);

// Protected
router.get("/me", auth, me);

export default router;
