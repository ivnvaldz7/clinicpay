# ClinicPay — Features

| Module                              | Description                                                                   | Status    |
| ----------------------------------- | ----------------------------------------------------------------------------- | --------- |
| Onboarding de clínica               | Alta de clínica, configuración inicial, plan/trial y datos básicos            | parcial   |
| Auth y roles                        | Login, refresh token, JWT, roles (`clinic_admin`, `staff`)                    | listo     |
| Gestión de pacientes                | CRUD de pacientes, búsqueda, estado activo/inactivo, notas                    | listo     |
| Módulo de cobros (invoices)         | CRUD de invoices, estados, vencimientos, links de pago Stripe                 | listo     |
| Registro de pagos                   | Registro manual (cash/transfer) y automático (stripe) + conciliación básica   | listo     |
| Dashboard financiero                | Métricas de ingresos, pagos por período, overdue, gráficos con Recharts       | listo     |
| Recordatorios automáticos por email | Cron job para overdue + envío por Resend + deduplicación via `reminderSentAt` | listo     |
| Billing y suscripciones con Stripe  | Customer + Subscription por clínica, webhooks, feature gating por plan        | parcial   |

## Notas de Estado

- `Auth`, `patients`, `invoices`, `payments`, `dashboard`, `jobs` y `billing/webhook` tienen cobertura mínima automatizada en backend.
- El acceso demo está deshabilitado en producción salvo que `ENABLE_DEMO_LOGIN=true`.
- El recordatorio de overdue quedó gated por plan `basic+` y estado de suscripción activo/trialing.
- El checkout de pago por invoice ya no hace fallback implícito de `ARS` a `USD` sin conversión.
