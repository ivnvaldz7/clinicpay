import mongoose from "mongoose";
import Invoice from "../models/Invoice.js";
import Payment from "../models/Payment.js";
import {
  applyDateRange,
  assertEnum,
  assertRequiredFields,
  parsePagination,
} from "../utils/validation.js";

// ─── helpers ────────────────────────────────────────────────────────────────

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

/**
 * Returns invoices that are considered overdue:
 *   - status = "overdue"  (already flagged by the cron job), OR
 *   - status = "pending"  AND dueDate < today (cron hasn't run yet)
 */
const overdueFilter = (clinicId) => ({
  clinicId,
  $or: [
    { status: "overdue" },
    { status: "pending", dueDate: { $lt: new Date() } },
  ],
});

// ─── controllers ────────────────────────────────────────────────────────────

/**
 * GET /dashboard/summary
 * Optional query: currency (ARS|USD) — defaults to all
 *
 * Returns:
 *   invoiced   { count, amount }  — all non-canceled invoices
 *   collected  { count, amount }  — paid invoices
 *   pending    { count, amount }  — pending invoices (not overdue)
 *   overdue    { count, amount }  — effectively overdue invoices
 *   patients   { total }          — active patients count
 */
export const getSummary = async (req, res, next) => {
  try {
    const { currency } = req.query;
    const clinicId = toObjectId(req.clinicId);

    const currencyMatch = currency
      ? { currency: assertEnum(currency, ["ARS", "USD"], "currency") }
      : {};

    const [invoiceStats, overdueStats, patientCount] = await Promise.all([
      // Aggregate invoices by status
      Invoice.aggregate([
        {
          $match: {
            clinicId,
            status: { $ne: "canceled" },
            ...currencyMatch,
          },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            amount: { $sum: "$amount" },
          },
        },
      ]),

      // Overdue: status=overdue OR (pending + past dueDate)
      Invoice.aggregate([
        {
          $match: {
            clinicId,
            ...currencyMatch,
            $or: [
              { status: "overdue" },
              { status: "pending", dueDate: { $lt: new Date() } },
            ],
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            amount: { $sum: "$amount" },
          },
        },
      ]),

      // Active patient count (import inline to avoid circular issues)
      mongoose.model("Patient").countDocuments({
        clinicId,
        isActive: true,
      }),
    ]);

    // Build a lookup map from aggregation results
    const byStatus = {};
    for (const row of invoiceStats) {
      byStatus[row._id] = { count: row.count, amount: row.amount };
    }

    const paid = byStatus.paid ?? { count: 0, amount: 0 };
    const pending = byStatus.pending ?? { count: 0, amount: 0 };
    const overdue = overdueStats[0] ?? { count: 0, amount: 0 };

    // Total invoiced = paid + pending + overdue (non-canceled)
    const invoicedAmount =
      (byStatus.paid?.amount ?? 0) +
      (byStatus.pending?.amount ?? 0) +
      (byStatus.overdue?.amount ?? 0);
    const invoicedCount =
      (byStatus.paid?.count ?? 0) +
      (byStatus.pending?.count ?? 0) +
      (byStatus.overdue?.count ?? 0);

    return res.json({
      data: {
        invoiced: { count: invoicedCount, amount: invoicedAmount },
        collected: { count: paid.count, amount: paid.amount },
        pending: { count: pending.count, amount: pending.amount },
        overdue: { count: overdue.count, amount: overdue.amount },
        patients: { total: patientCount },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /dashboard/revenue
 * Returns payment totals grouped by period — ready for Recharts.
 *
 * Query params:
 *   - from     (ISO date, required)
 *   - to       (ISO date, required)
 *   - groupBy  ("day" | "week" | "month", default "day")
 *   - currency (ARS | USD, optional)
 *
 * Response shape:
 *   [{ period: "2024-05", amount: 150000, count: 12 }, ...]
 */
export const getRevenue = async (req, res, next) => {
  try {
    const { from, to, groupBy = "day", currency } = req.query;

    assertRequiredFields([
      [from, "from and to dates are required"],
      [to, "from and to dates are required"],
    ]);
    assertEnum(groupBy, ["day", "week", "month"], "groupBy");

    const dateFormat = { day: "%Y-%m-%d", week: "%Y-%U", month: "%Y-%m" }[groupBy];

    const match = {
      clinicId: toObjectId(req.clinicId),
    };
    applyDateRange(match, { from, to });
    if (currency) match.currency = assertEnum(currency, ["ARS", "USD"], "currency");

    const rows = await Payment.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
          amount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          period: "$_id",
          amount: 1,
          count: 1,
        },
      },
    ]);

    return res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /dashboard/overdue
 * Returns the list of effectively overdue invoices with patient info.
 *
 * Query params:
 *   - currency (ARS | USD, optional)
 *   - page     (default 1)
 *   - limit    (default 20, max 100)
 */
export const getOverdue = async (req, res, next) => {
  try {
    const { currency, page = 1, limit = 20 } = req.query;

    const filter = overdueFilter(toObjectId(req.clinicId));
    if (currency) filter.currency = assertEnum(currency, ["ARS", "USD"], "currency");

    const { page: pageNum, limit: limitNum, skip } = parsePagination({ page, limit });

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .populate("patientId", "name email phone dni")
        .sort({ dueDate: 1 }) // oldest first
        .skip(skip)
        .limit(limitNum),
      Invoice.countDocuments(filter),
    ]);

    return res.json({
      data: invoices,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
};
