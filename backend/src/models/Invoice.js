import { Schema, model } from "mongoose";

const InvoiceSchema = new Schema(
  {
    clinicId: { type: Schema.Types.ObjectId, ref: "Clinic", required: true },
    patientId: { type: Schema.Types.ObjectId, ref: "Patient", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    concept: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    currency: { type: String, enum: ["ARS", "USD"], default: "ARS" },
    status: {
      type: String,
      enum: ["pending", "paid", "overdue", "canceled"],
      default: "pending",
    },
    dueDate: { type: Date, required: true },
    paidAt: { type: Date, default: null },
    stripePaymentLinkId: { type: String, default: null },
    stripePaymentLinkUrl: { type: String, default: null },
    reminderSentAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

export default model("Invoice", InvoiceSchema);
