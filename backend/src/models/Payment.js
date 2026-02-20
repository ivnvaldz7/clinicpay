import { Schema, model } from "mongoose";

const PaymentSchema = new Schema(
  {
    clinicId: { type: Schema.Types.ObjectId, ref: "Clinic", required: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", required: true },
    patientId: { type: Schema.Types.ObjectId, ref: "Patient", required: true },
    amount: { type: Number, required: true },
    currency: { type: String, enum: ["ARS", "USD"], default: "ARS" },
    method: {
      type: String,
      enum: ["cash", "transfer", "stripe", "mercadopago"],
      required: true,
    },
    stripePaymentIntentId: { type: String, default: null },
    notes: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

export default model("Payment", PaymentSchema);
