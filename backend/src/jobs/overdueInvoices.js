import cron from "node-cron";
import Invoice from "../models/Invoice.js";
import { sendOverdueReminder } from "../services/email.service.js";

// Don't resend a reminder if one was sent within this many hours
const REMINDER_COOLDOWN_HOURS = 24;

/**
 * Core job logic — exported so it can be triggered manually or tested.
 *
 * For each invoice that is effectively overdue and whose patient has an email:
 *   1. Marks the invoice status as "overdue" (if still "pending")
 *   2. Skips if a reminder was sent within REMINDER_COOLDOWN_HOURS
 *   3. Sends the email via Resend
 *   4. Stamps reminderSentAt to prevent duplicate sends
 */
export const processOverdueInvoices = async () => {
  const now = new Date();
  const cooldownCutoff = new Date(now.getTime() - REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000);

  console.log(`[overdueInvoices] Running at ${now.toISOString()}`);

  // Find all effectively overdue invoices and populate patient + clinic
  const invoices = await Invoice.find({
    $or: [
      { status: "overdue" },
      { status: "pending", dueDate: { $lt: now } },
    ],
  })
    .populate("patientId", "name email")
    .populate("clinicId", "name");

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const invoice of invoices) {
    // Mark as overdue if it's still pending
    if (invoice.status === "pending") {
      invoice.status = "overdue";
      // save happens below, or after the email block
    }

    const patient = invoice.patientId;
    const clinic = invoice.clinicId;

    // Skip if patient has no email
    if (!patient?.email) {
      await invoice.save();
      skipped++;
      continue;
    }

    // Skip if a reminder was sent recently (deduplication)
    if (invoice.reminderSentAt && invoice.reminderSentAt > cooldownCutoff) {
      await invoice.save(); // still persist status change
      skipped++;
      continue;
    }

    try {
      await sendOverdueReminder({
        to: patient.email,
        patientName: patient.name,
        clinicName: clinic.name,
        concept: invoice.concept,
        amount: invoice.amount,
        currency: invoice.currency,
        dueDate: invoice.dueDate,
      });

      invoice.reminderSentAt = now;
      await invoice.save();
      sent++;
    } catch (err) {
      console.error(
        `[overdueInvoices] Failed to send reminder for invoice ${invoice._id}:`,
        err.message,
      );
      // Still persist the status change even if the email failed
      await invoice.save();
      errors++;
    }
  }

  console.log(
    `[overdueInvoices] Done — sent: ${sent}, skipped: ${skipped}, errors: ${errors}`,
  );
};

/**
 * Registers the cron job. Called once from server.js after DB connects.
 *
 * Schedule: every day at 08:00 server time.
 * Override via OVERDUE_CRON_SCHEDULE env var (standard cron syntax).
 */
export const scheduleOverdueJob = () => {
  const schedule = process.env.OVERDUE_CRON_SCHEDULE ?? "0 8 * * *";

  cron.schedule(schedule, () => {
    processOverdueInvoices().catch((err) => {
      console.error("[overdueInvoices] Unhandled error:", err.message);
    });
  });

  console.log(`[overdueInvoices] Scheduled — "${schedule}"`);
};
