import { Schema, model } from "mongoose";

const PatientSchema = new Schema(
  {
    clinicId: { type: Schema.Types.ObjectId, ref: "Clinic", required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, default: null, lowercase: true },
    phone: { type: String, default: null },
    dni: { type: String, default: null },
    notes: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

export default model("Patient", PatientSchema);
