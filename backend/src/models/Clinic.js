import { Schema, model } from "mongoose";

const ClinicSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: null },
    address: { type: String, default: null },
    plan: { type: String, enum: ["free", "basic", "pro"], default: "free" },
    stripeCustomerId: { type: String, default: null },
    stripeSubscriptionId: { type: String, default: null },
    subscriptionStatus: {
      type: String,
      enum: ["active", "trialing", "past_due", "canceled"],
      default: "trialing",
    },
    trialEndsAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

export default model("Clinic", ClinicSchema);
