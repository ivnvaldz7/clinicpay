import Clinic from "../models/Clinic.js";

const PLAN_HIERARCHY = { free: 0, basic: 1, pro: 2 };

/**
 * Gate a route to a minimum plan level.
 * Usage: checkPlan("basic")
 * Must be placed after auth + tenant middlewares.
 */
export const checkPlan = (minPlan) =>
  async (req, res, next) => {
    try {
      const clinic = await Clinic.findById(req.clinicId).select("plan subscriptionStatus");
      if (!clinic) {
        return res.status(404).json({ message: "Clinic not found" });
      }

      if (clinic.subscriptionStatus === "canceled") {
        return res.status(403).json({ message: "Subscription canceled" });
      }

      const clinicLevel = PLAN_HIERARCHY[clinic.plan] ?? 0;
      const requiredLevel = PLAN_HIERARCHY[minPlan] ?? 0;

      if (clinicLevel < requiredLevel) {
        return res.status(403).json({
          message: `This feature requires the '${minPlan}' plan or higher`,
        });
      }

      req.clinic = clinic;
      next();
    } catch (err) {
      next(err);
    }
  };
