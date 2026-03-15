# ClinicPay

ClinicPay is a multi-tenant SaaS platform for clinics that centralizes patient billing, payment tracking, subscription management, and financial visibility in a single product.

Built as a full-stack project for portfolio presentation, it focuses on real product concerns beyond CRUD: role-based access control, tenant isolation, billing automation, Stripe checkout flows, reminder jobs, and backend test coverage for critical business rules.

## Live Demo

- Live app: [https://clinicpay.netlify.app](https://clinicpay.netlify.app)
- API health: [https://clinicpay.onrender.com/health](https://clinicpay.onrender.com/health)
- Repository: [https://github.com/ivnvaldz7/clinicpay](https://github.com/ivnvaldz7/clinicpay)

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

## Production Deployment

For a serious portfolio deployment, ClinicPay should run as three services:

- Frontend on Netlify
- Backend API on Render or Railway
- MongoDB on MongoDB Atlas

This keeps the architecture clear, production-like, and easy to explain in a portfolio review.

### Recommended production stack

- Netlify for the React application
- Render or Railway for the Express API
- MongoDB Atlas for the database
- Stripe for subscriptions and invoice payments
- Resend for transactional emails

### Netlify frontend

This repository already includes:

- [netlify.toml](C:/Users/Usuario/Desktop/clinic-pay/netlify.toml) for build settings
- [frontend/public/_redirects](C:/Users/Usuario/Desktop/clinic-pay/frontend/public/_redirects) so React Router works on refresh

Set this environment variable in Netlify:

```bash
VITE_API_URL=https://your-backend-domain.com
```

### Backend service

Deploy the `backend/` app as a Node service with:

- Build command: `npm install`
- Start command: `npm start`

Production backend environment variables should include:

```bash
PORT=4000
MONGODB_URI=mongodb+srv://...
JWT_ACCESS_SECRET=your-long-random-secret
JWT_REFRESH_SECRET=your-long-random-secret
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
CLIENT_ORIGIN=https://your-netlify-site.netlify.app
COOKIE_SAME_SITE=none
COOKIE_SECURE=true
STRIPE_SECRET_KEY=sk_live_or_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_BASIC=price_...
STRIPE_PRICE_PRO=price_...
RESEND_API_KEY=re_...
EMAIL_FROM=ClinicPay <noreply@yourdomain.com>
OVERDUE_CRON_SCHEDULE=0 8 * * *
```

`COOKIE_SAME_SITE=none` and `COOKIE_SECURE=true` are required when the frontend and backend run on different domains, which is the standard Netlify + API hosting setup.

### MongoDB Atlas

Create a shared cluster in MongoDB Atlas and whitelist the backend host IPs or allow access from anywhere while you are still in portfolio/demo mode.

Use the Atlas connection string in:

```bash
MONGODB_URI=mongodb+srv://...
```

### Stripe webhook

After the backend is deployed, configure your Stripe webhook endpoint as:

```text
https://your-backend-domain.com/billing/webhook
```

Subscribe it to at least:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

### Deployment checklist

- frontend deployed on Netlify
- backend deployed on Render or Railway
- MongoDB Atlas connected
- `CLIENT_ORIGIN` points to the Netlify URL
- `VITE_API_URL` points to the backend URL
- cookie settings use `none` + `true` in production
- Stripe webhook configured against the deployed backend
- frontend lint passes
- backend tests pass

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
