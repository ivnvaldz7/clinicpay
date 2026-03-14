# ClinicPay

ClinicPay is a multi-tenant SaaS platform for clinics that centralizes patient billing, payment tracking, subscription management, and financial visibility in a single product.

Built as a full-stack project for portfolio presentation, it focuses on real product concerns beyond CRUD: role-based access control, tenant isolation, billing automation, Stripe checkout flows, reminder jobs, and backend test coverage for critical business rules.

## Highlights

- Multi-tenant architecture with `clinicId`-scoped data access
- JWT auth with access token + refresh token flow
- Role-based permissions for `clinic_admin` and `staff`
- Patient, invoice, and payment management
- Stripe-powered invoice payment links
- Stripe subscription billing and webhook synchronization
- Overdue reminder job gated by plan
- Financial dashboard with revenue, overdue, and collection metrics
- Integration and domain tests for sensitive flows

## Product Scope

ClinicPay covers the core operational flows of a small clinic:

- Patient management
- Invoice creation and tracking
- Manual and automated payment registration
- Subscription and plan management
- Revenue and overdue monitoring
- Reminder automation for unpaid invoices

## Tech Stack

### Frontend

- React 19
- Vite
- React Router
- Zustand
- Tailwind CSS
- Radix UI
- Recharts
- Axios

### Backend

- Node.js
- Express
- MongoDB + Mongoose
- JWT
- Stripe
- Resend
- node-cron

### Testing

- Node test runner
- mongodb-memory-server

## Architecture

The codebase is split into two applications:

```text
clinic-pay/
  backend/
  frontend/
  docs/
```

### Backend design

The backend follows a layered structure with:

- `controllers/` for HTTP orchestration
- `routes/` for endpoint composition
- `services/` for domain and third-party integrations
- `middlewares/` for auth, tenant resolution, and plan gating
- `utils/` for shared validation helpers
- `jobs/` for scheduled business processes

Multi-tenancy is enforced through authenticated tenant context and `clinicId` filters in every tenant-scoped query.

### Frontend design

The frontend is organized by feature modules:

- `auth`
- `patients`
- `invoices`
- `payments`
- `dashboard`
- `billing`

Shared UI and layout logic live in reusable component layers to keep pages focused on product behavior.

## Engineering Focus

This project was intentionally improved to reflect production-minded engineering decisions:

- shared request validation utilities
- centralized invoice domain rules and reconciliation logic
- protected session hydration flow on frontend boot
- explicit invoice state transitions
- webhook idempotency for payment registration
- plan-based restrictions for premium automation
- integration tests around auth, billing, dashboard, roles, and tenant isolation

## Test Coverage

The backend currently includes automated coverage for:

- register / login / refresh / current user
- tenant isolation across invoices and payments
- payment reconciliation
- invoice transition rules
- overdue job plan gating
- Stripe checkout webhook idempotency
- dashboard summary, revenue, and overdue endpoints
- billing status and validation failures
- role-based restrictions for admin-only actions

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/ivnvaldz7/clinicpay.git
cd clinicpay
```

### 2. Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 3. Configure environment variables

Create `.env` files in both `backend/` and `frontend/` using the provided examples:

- `backend/.env.example`
- `frontend/.env.example`

### 4. Run the apps

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

## Quality Checks

Frontend lint:

```bash
cd frontend
npm run lint
```

Backend tests:

```bash
cd backend
npm test
```

## Status

Current state of the project:

- frontend lint passing
- backend tests passing
- payment link flow implemented
- dashboard and billing flows covered by tests
- documentation aligned with current implementation

## Why This Project Stands Out

ClinicPay is not just a UI demo. It demonstrates:

- product thinking
- backend business logic design
- real-world billing concerns
- auth and permission boundaries
- testing around risky workflows
- iterative refactoring toward cleaner architecture

## Repository Notes

- `docs/` contains additional architecture and feature notes
- `frontend/README.md` contains package-level frontend notes

## Author

Built by Ivan Valdez as a portfolio project focused on SaaS product engineering, backend reliability, and full-stack application design.
