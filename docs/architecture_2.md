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
      invoice.service.js
      stripe.service.js
      email.service.js
    utils/
      validation.js
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
        variants.js
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
8. On app bootstrap, the frontend stores the refreshed `accessToken` before calling `GET /auth/me`, avoiding session loss on reload.

**Roles:**

- `clinic_admin` — full access within their clinic (patients, invoices, billing, staff management)
- `staff` — can create/view patients and invoices, cannot access billing or settings

Current route-level behavior:

- `staff` can create invoices and register payments.
- `staff` cannot access billing endpoints or hard-delete patient/payment records.
- `clinic_admin` can access billing, cancel invoices, run overdue jobs, and perform destructive actions.

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

This isolation is covered by integration tests that verify one clinic cannot read or pay another clinic's invoices.

---

## Validation + Domain Rules

- Shared request validation helpers now live in `backend/src/utils/validation.js`.
- Invoice domain rules now live in `backend/src/services/invoice.service.js`.
- Controllers use those modules to reduce duplicated validation and keep business rules consistent.

Examples:

- invoice transitions are centralized
- payment reconciliation is centralized
- pagination and date-range parsing are shared

---

## Testing Status

Backend has a minimal automated suite using Node's built-in test runner plus `mongodb-memory-server`.

Covered scenarios include:

- auth register / login / refresh / me
- tenant isolation across invoices and payments
- invoice payment reconciliation
- invoice transition rules
- overdue job plan gating
- Stripe checkout webhook idempotency
- role-based access control
- dashboard summary / revenue / overdue endpoints
- billing status and validation failures for checkout / portal

---

## Entity Relationships

- **User** belongs to **Clinic** (via `clinicId`)
- **Patient** belongs to **Clinic** (via `clinicId`)
- **Invoice** belongs to **Clinic** and **Patient** (via `clinicId`, `patientId`), created by a **User** (via `createdBy`)
- **Payment** belongs to **Clinic**, **Invoice**, and **Patient** (via `clinicId`, `invoiceId`, `patientId`)
