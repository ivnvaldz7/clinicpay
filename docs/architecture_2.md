# ClinicPay — Architecture

## Overview + Business Model

ClinicPay is a SaaS for small clinics that manages patient billing and payments:

- Invoices + payment history per patient
- Automated email reminders for overdue invoices
- Installment plans (future extension on invoices/payments)
- Revenue dashboard
- PDF receipts

**SaaS model**

- Each clinic pays a monthly subscription (`free|basic|pro`) managed by Stripe Subscriptions.
- Plan gates features/limits (reminders, exports, volume limits, etc.).
- Patient payments can be processed via Stripe (test mode initially).
- Emails are sent via Resend.

---

## Tech Decisions

| Concern       | Choice                             |
| ------------- | ---------------------------------- |
| Auth          | JWT (access + refresh token)       |
| Payments      | Stripe (test mode)                 |
| Email         | Resend                             |
| UI            | Tailwind + shadcn/ui               |
| Charts        | Recharts                           |
| Global state  | Zustand                            |
| Cron          | node-cron                          |
| Multi-tenancy | clinicId field + tenant middleware |

---

## Backend Folder Structure

```txt
backend/
  src/
    config/
    models/
    middlewares/
      auth.js
      tenant.js
      checkPlan.js
    controllers/
    routes/
    services/
      stripe.service.js
      email.service.js
    jobs/
      overdueInvoices.js
    app.js
    server.js
```

---

## Frontend Folder Structure

```txt
frontend/
  src/
    api/
    components/
      ui/
      shared/
    features/
      auth/
      patients/
      invoices/
      payments/
      dashboard/
    hooks/
    store/
    pages/
    App.jsx
```

---

## JWT Auth Flow + Roles

1. User hits `POST /auth/login` with email + password.
2. Server validates credentials, returns:
   - `accessToken` (JWT, expires 15min) containing `{ userId, clinicId, role }`
   - `refreshToken` (JWT, expires 7 days) stored in httpOnly cookie
3. Client stores `accessToken` in memory (not localStorage).
4. Every protected request includes `Authorization: Bearer <accessToken>`.
5. `auth.js` middleware verifies the token and injects `req.user = { userId, clinicId, role }`.
6. `tenant.js` middleware reads `req.user.clinicId` and sets `req.clinicId` — used in every query.
7. When `accessToken` expires, client hits `POST /auth/refresh` using the httpOnly cookie to get a new one.

**Roles:**

- `clinic_admin` — full access within their clinic (patients, invoices, billing, staff management)
- `staff` — can create/view patients and invoices, cannot access billing or settings

---

## Multi-Tenancy

Single database strategy. Every tenant-scoped document includes a `clinicId` field referencing the `Clinic` collection.

The `tenant.js` middleware injects `req.clinicId` automatically on every authenticated route. Controllers always filter queries using `req.clinicId` — never hardcoded or passed from the client.

```js
// middlewares/tenant.js
export const tenantMiddleware = (req, res, next) => {
  if (!req.user?.clinicId) {
    return res.status(403).json({ message: "Tenant not identified" });
  }
  req.clinicId = req.user.clinicId;
  next();
};

// Example usage in routes
router.get("/patients", auth, tenant, getPatients);

// Example usage in controller
const patients = await Patient.find({ clinicId: req.clinicId });
```

---

## Entity Relationships

- **User** belongs to **Clinic** (via `clinicId`)
- **Patient** belongs to **Clinic** (via `clinicId`)
- **Invoice** belongs to **Clinic** and **Patient** (via `clinicId`, `patientId`), created by a **User** (via `createdBy`)
- **Payment** belongs to **Clinic**, **Invoice**, and **Patient** (via `clinicId`, `invoiceId`, `patientId`)
