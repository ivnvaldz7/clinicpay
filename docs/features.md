# ClinicPay — Features

| Module                              | Description                                                                   | Status    |
| ----------------------------------- | ----------------------------------------------------------------------------- | --------- |
| Onboarding de clínica               | Alta de clínica, configuración inicial, plan/trial y datos básicos            | pendiente |
| Auth y roles                        | Login, refresh token, JWT, roles (`clinic_admin`, `staff`)                    | pendiente |
| Gestión de pacientes                | CRUD de pacientes, búsqueda, estado activo/inactivo, notas                    | pendiente |
| Módulo de cobros (invoices)         | CRUD de invoices, estados, vencimientos, links de pago Stripe                 | pendiente |
| Registro de pagos                   | Registro manual (cash/transfer) y automático (stripe) + conciliación básica   | pendiente |
| Dashboard financiero                | Métricas de ingresos, pagos por período, overdue, gráficos con Recharts       | pendiente |
| Recordatorios automáticos por email | Cron job para overdue + envío por Resend + deduplicación via `reminderSentAt` | pendiente |
| Billing y suscripciones con Stripe  | Customer + Subscription por clínica, webhooks, feature gating por plan        | pendiente |
