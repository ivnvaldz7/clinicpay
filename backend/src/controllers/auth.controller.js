import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Clinic from "../models/Clinic.js";
import User from "../models/User.js";
import { assertRequiredFields } from "../utils/validation.js";

// ─── helpers ────────────────────────────────────────────────────────────────

const SALT_ROUNDS = 12;

const signAccessToken = (payload) =>
  jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES ?? "15m",
  });

const signRefreshToken = (payload) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES ?? "7d",
  });

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: process.env.COOKIE_SAME_SITE ?? "strict",
  secure:
    process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

const REFRESH_COOKIE_CLEAR_OPTIONS = {
  httpOnly: REFRESH_COOKIE_OPTIONS.httpOnly,
  sameSite: REFRESH_COOKIE_OPTIONS.sameSite,
  secure: REFRESH_COOKIE_OPTIONS.secure,
};

const buildTokenPayload = (user) => ({
  userId: user._id,
  clinicId: user.clinicId,
  role: user.role,
});

// ─── controllers ────────────────────────────────────────────────────────────

/**
 * POST /auth/register
 * Creates a new Clinic and its first clinic_admin user.
 *
 * Body: { clinicName, clinicEmail, name, email, password }
 */
export const register = async (req, res, next) => {
  try {
    const { clinicName, clinicEmail, name, email, password } = req.body;

    assertRequiredFields([
      [clinicName, "All fields are required"],
      [clinicEmail, "All fields are required"],
      [name, "All fields are required"],
      [email, "All fields are required"],
      [password, "All fields are required"],
    ]);

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const clinic = await Clinic.create({
      name: clinicName,
      email: clinicEmail,
    });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await User.create({
      clinicId: clinic._id,
      name,
      email,
      passwordHash,
      role: "clinic_admin",
    });

    const payload = buildTokenPayload(user);
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);

    return res.status(201).json({
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        clinicId: user.clinicId,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/login
 * Body: { email, password }
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    assertRequiredFields([
      [email, "Email and password are required"],
      [password, "Email and password are required"],
    ]);

    const user = await User.findOne({ email });
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const payload = buildTokenPayload(user);
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);

    return res.json({
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        clinicId: user.clinicId,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/refresh
 * Reads the httpOnly refreshToken cookie and issues a new accessToken.
 */
export const refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ message: "No refresh token" });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }

    // Ensure user still exists and is active
    const user = await User.findById(payload.userId).select("isActive clinicId role");
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "User not found or inactive" });
    }

    const newPayload = buildTokenPayload(user);
    const accessToken = signAccessToken(newPayload);

    return res.json({ accessToken });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/logout
 * Clears the refresh token cookie.
 */
export const logout = (_req, res) => {
  res.clearCookie("refreshToken", REFRESH_COOKIE_CLEAR_OPTIONS);
  return res.json({ message: "Logged out" });
};

/**
 * GET /auth/me
 * Returns the current authenticated user.
 * Requires auth middleware.
 */
export const me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.json({ user });
  } catch (err) {
    next(err);
  }
};
