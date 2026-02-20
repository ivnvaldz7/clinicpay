import jwt from "jsonwebtoken";

/**
 * Verifies the Authorization: Bearer <accessToken> header.
 * Injects req.user = { userId, clinicId, role } on success.
 */
export const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = {
      userId: payload.userId,
      clinicId: payload.clinicId,
      role: payload.role,
    };
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }
    return res.status(401).json({ message: "Invalid token" });
  }
};

/**
 * Role guard factory. Usage: requireRole("clinic_admin")
 * Must be placed after auth middleware.
 */
export const requireRole = (...roles) =>
  (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthenticated" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: insufficient role" });
    }
    next();
  };
