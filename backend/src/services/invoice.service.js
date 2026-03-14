import Invoice from "../models/Invoice.js";
import Payment from "../models/Payment.js";

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

export const findInvoiceForClinic = async (invoiceId, clinicId) => {
  const invoice = await Invoice.findOne({ _id: invoiceId, clinicId });
  if (!invoice) {
    throw createHttpError(404, "Invoice not found");
  }
  return invoice;
};

export const reconcileInvoice = async (invoice) => {
  const payments = await Payment.find({ invoiceId: invoice._id });
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);

  if (totalPaid >= invoice.amount && invoice.status !== "paid") {
    invoice.status = "paid";
    invoice.paidAt = new Date();
  } else if (totalPaid < invoice.amount && invoice.status === "paid") {
    invoice.status = "pending";
    invoice.paidAt = null;
  }

  await invoice.save();
  return invoice;
};

export const assertInvoiceCanReceivePayment = (invoice) => {
  if (invoice.status === "canceled") {
    throw createHttpError(409, "Cannot register a payment on a canceled invoice");
  }

  if (invoice.status === "paid") {
    throw createHttpError(409, "Invoice is already fully paid");
  }
};

export const assertInvoiceCanBeEdited = (invoice) => {
  if (invoice.status !== "pending") {
    throw createHttpError(409, "Only pending invoices can be edited");
  }
};

export const resolveInvoiceTransition = (invoice, nextStatus, role) => {
  if (nextStatus === invoice.status) {
    return;
  }

  if (invoice.status === "paid") {
    throw createHttpError(409, "Paid invoices cannot be changed manually");
  }

  if (invoice.status === "canceled") {
    throw createHttpError(409, "Canceled invoices cannot be changed");
  }

  if (nextStatus === "paid") {
    return;
  }

  if (nextStatus === "canceled") {
    if (role !== "clinic_admin") {
      throw createHttpError(403, "Only clinic_admin can cancel invoices");
    }
    return;
  }

  if (nextStatus === "overdue") {
    if (role !== "clinic_admin") {
      throw createHttpError(403, "Only clinic_admin can mark invoices as overdue");
    }

    if (invoice.status !== "pending") {
      throw createHttpError(409, "Only pending invoices can become overdue");
    }

    return;
  }

  throw createHttpError(
    409,
    `Cannot change invoice status from '${invoice.status}' to '${nextStatus}'`,
  );
};
