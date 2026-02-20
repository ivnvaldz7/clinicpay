/**
 * Reads req.user.clinicId (set by auth middleware) and injects req.clinicId.
 * All controllers must filter queries using req.clinicId — never trust the client.
 * Must be placed after auth middleware.
 */
export const tenant = (req, res, next) => {
  if (!req.user?.clinicId) {
    return res.status(403).json({ message: "Tenant not identified" });
  }
  req.clinicId = req.user.clinicId;
  next();
};
