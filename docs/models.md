# ClinicPay — Models (Mongoose)

All tenant-scoped entities include `clinicId`.

---

## Clinic

Fields:

- `name`: String (required)
- `email`: String (required)
- `phone`: String (optional)
- `address`: String (optional)
- `plan`: enum `["free","basic","pro"]` (default `"free"`)
- `stripeCustomerId`: String (optional)
- `stripeSubscriptionId`: String (optional)
- `subscriptionStatus`: enum `["active","trialing","past_due","canceled"]` (default `"trialing"`)
- `trialEndsAt`: Date (optional)
- `createdAt`: Date (default now)

```js
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
```

---

## User

Fields:

- `clinicId`: ObjectId ref `Clinic` (required)
- `name`: String (required)
- `email`: String (required, unique)
- `passwordHash`: String (required)
- `role`: enum `["clinic_admin","staff"]` (default `"staff"`)
- `isActive`: Boolean (default `true`)
- `createdAt`: Date (default now)

```js
const UserSchema = new Schema(
  {
    clinicId: { type: Schema.Types.ObjectId, ref: "Clinic", required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["clinic_admin", "staff"], default: "staff" },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
```

---

## Patient

Fields:

- `clinicId`: ObjectId ref `Clinic` (required)
- `name`: String (required)
- `email`: String (optional)
- `phone`: String (optional)
- `dni`: String (optional)
- `notes`: String (optional)
- `isActive`: Boolean (default `true`)
- `createdAt`: Date (default now)

```js
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
```

---

## Invoice

Fields:

- `clinicId`: ObjectId ref `Clinic` (required)
- `patientId`: ObjectId ref `Patient` (required)
- `createdBy`: ObjectId ref `User` (required)
- `concept`: String (required)
- `amount`: Number (required)
- `currency`: enum `["ARS","USD"]` (default `"ARS"`)
- `status`: enum `["pending","paid","overdue","canceled"]` (default `"pending"`)
- `dueDate`: Date (required)
- `paidAt`: Date (optional)
- `stripePaymentLinkId`: String (optional)
- `stripePaymentLinkUrl`: String (optional)
- `reminderSentAt`: Date (optional)
- `createdAt`: Date (default now)

```js
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
```

---

## Payment

Fields:

- `clinicId`: ObjectId ref `Clinic` (required)
- `invoiceId`: ObjectId ref `Invoice` (required)
- `patientId`: ObjectId ref `Patient` (required)
- `amount`: Number (required)
- `currency`: enum `["ARS","USD"]` (default `"ARS"`)
- `method`: enum `["cash","transfer","stripe","mercadopago"]` (required)
- `stripePaymentIntentId`: String (optional)
- `notes`: String (optional)
- `createdAt`: Date (default now)

```js
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
```

---

## Entity Relationships

- **User** → belongs to **Clinic** (`clinicId`)
- **Patient** → belongs to **Clinic** (`clinicId`)
- **Invoice** → belongs to **Clinic** + **Patient** + created by **User**
- **Payment** → belongs to **Clinic** + **Invoice** + **Patient**
