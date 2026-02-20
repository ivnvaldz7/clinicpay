import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, ExternalLink, Zap, Shield, Star, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { billingApi } from "@/api/billing.api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { cn } from "@/lib/utils";

// ─── static plan definitions ─────────────────────────────────────────────────

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: null,
    description: "Para empezar a organizarte sin costo.",
    icon: Shield,
    priceId: null,
    features: [
      "Hasta 20 pacientes",
      "Cobros e invoices ilimitados",
      "Registro manual de pagos",
      "Dashboard básico",
    ],
    missing: [
      "Recordatorios automáticos por email",
      "Exportación de datos",
      "Pagos vía Stripe",
      "Soporte prioritario",
    ],
  },
  {
    id: "basic",
    name: "Basic",
    price: "$ 29 USD / mes",
    description: "Para clínicas que necesitan automatizar cobros.",
    icon: Zap,
    priceId: import.meta.env.VITE_STRIPE_PRICE_BASIC,
    popular: false,
    features: [
      "Pacientes ilimitados",
      "Cobros e invoices ilimitados",
      "Registro manual de pagos",
      "Dashboard financiero completo",
      "Recordatorios automáticos por email",
      "Exportación de datos",
    ],
    missing: [
      "Pagos vía Stripe",
      "Soporte prioritario",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$ 79 USD / mes",
    description: "Para clínicas con volumen alto y pagos online.",
    icon: Star,
    priceId: import.meta.env.VITE_STRIPE_PRICE_PRO,
    popular: true,
    features: [
      "Todo lo de Basic",
      "Pagos vía Stripe (links de pago)",
      "Webhooks y conciliación automática",
      "Soporte prioritario",
      "Acceso anticipado a nuevas funciones",
    ],
    missing: [],
  },
];

// ─── helpers ─────────────────────────────────────────────────────────────────

const STATUS_MAP = {
  active: { label: "Activa", variant: "success" },
  trialing: { label: "En prueba", variant: "warning" },
  past_due: { label: "Pago vencido", variant: "destructive" },
  canceled: { label: "Cancelada", variant: "outline" },
};

const PLAN_ORDER = { free: 0, basic: 1, pro: 2 };

const fmtDate = (d) =>
  d
    ? new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "long", year: "numeric" }).format(
        new Date(d),
      )
    : null;

// ─── sub-components ───────────────────────────────────────────────────────────

const StatusBanner = ({ type, children, onDismiss }) => {
  const styles = {
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    error: "bg-red-50 border-red-200 text-red-800",
  };
  const icons = {
    success: CheckCircle2,
    warning: AlertTriangle,
    error: AlertTriangle,
  };
  const Icon = icons[type];

  return (
    <div className={cn("flex items-start gap-3 rounded-lg border p-4", styles[type])}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1 text-sm">{children}</p>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

const CurrentPlanCard = ({ clinic, onManage, managing }) => {
  const status = STATUS_MAP[clinic.subscriptionStatus] ?? STATUS_MAP.canceled;
  const plan = PLANS.find((p) => p.id === clinic.plan) ?? PLANS[0];
  const Icon = plan.icon;
  const trialDate = fmtDate(clinic.trialEndsAt);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold">{plan.name}</p>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {clinic.name} · {clinic.email}
              </p>
              {trialDate && clinic.subscriptionStatus === "trialing" && (
                <p className="mt-0.5 text-xs text-amber-600">
                  El período de prueba finaliza el {trialDate}
                </p>
              )}
            </div>
          </div>

          {clinic.stripeCustomerId && (
            <Button
              variant="outline"
              size="sm"
              onClick={onManage}
              disabled={managing}
              className="shrink-0"
            >
              {managing ? (
                "Redirigiendo…"
              ) : (
                <>
                  Gestionar suscripción
                  <ExternalLink className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          )}
        </div>

        {clinic.subscriptionStatus === "past_due" && (
          <div className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Tu pago está vencido. Actualizá tu método de pago para evitar la suspensión del servicio.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const PlanCard = ({ plan, currentPlan, onUpgrade, loading }) => {
  const Icon = plan.icon;
  const isCurrent = plan.id === currentPlan;
  const currentOrder = PLAN_ORDER[currentPlan] ?? 0;
  const planOrder = PLAN_ORDER[plan.id] ?? 0;
  const isDowngrade = planOrder < currentOrder;
  const isUpgrade = planOrder > currentOrder;

  return (
    <Card className={cn(
      "relative flex flex-col transition-shadow",
      plan.popular && "border-primary shadow-md",
      isCurrent && "bg-muted/30",
    )}>
      {plan.popular && (
        <div className="absolute -top-3 left-0 right-0 flex justify-center">
          <span className="rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
            Más popular
          </span>
        </div>
      )}

      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md",
            plan.popular ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}>
            <Icon className="h-4 w-4" />
          </div>
          <CardTitle className="text-base">{plan.name}</CardTitle>
        </div>
        {plan.price ? (
          <p className="mt-2 text-2xl font-bold">{plan.price}</p>
        ) : (
          <p className="mt-2 text-2xl font-bold">Gratis</p>
        )}
        <CardDescription>{plan.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-2 pb-4">
        {plan.features.map((f) => (
          <div key={f} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
            <span>{f}</span>
          </div>
        ))}
        {plan.missing.map((f) => (
          <div key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
            <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{f}</span>
          </div>
        ))}
      </CardContent>

      <CardFooter className="pt-0">
        {isCurrent ? (
          <Button className="w-full" variant="outline" disabled>
            Plan actual
          </Button>
        ) : isUpgrade && plan.priceId ? (
          <Button
            className="w-full"
            variant={plan.popular ? "default" : "outline"}
            onClick={() => onUpgrade(plan.priceId)}
            disabled={loading}
          >
            {loading ? "Redirigiendo…" : `Contratar ${plan.name}`}
          </Button>
        ) : isDowngrade ? (
          <Button className="w-full" variant="ghost" disabled>
            Disponible via portal
          </Button>
        ) : (
          <Button className="w-full" variant="outline" disabled>
            No disponible
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

// ─── page ─────────────────────────────────────────────────────────────────────

export const BillingPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [clinic, setClinic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [banner, setBanner] = useState(null); // { type, message }

  // Handle Stripe redirect params
  useEffect(() => {
    if (searchParams.get("success") === "1") {
      setBanner({ type: "success", message: "¡Suscripción activada correctamente! Puede tardar unos segundos en reflejarse." });
      setSearchParams({}, { replace: true });
    } else if (searchParams.get("canceled") === "1") {
      setBanner({ type: "warning", message: "El proceso de pago fue cancelado. Podés intentarlo de nuevo cuando quieras." });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await billingApi.status();
        setClinic(data.data);
      } catch (err) {
        setBanner({ type: "error", message: err.response?.data?.message ?? "Error al cargar el estado de la suscripción." });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleUpgrade = async (priceId) => {
    setCheckoutLoading(true);
    try {
      const { data } = await billingApi.checkout(priceId);
      window.location.href = data.url;
    } catch (err) {
      setBanner({ type: "error", message: err.response?.data?.message ?? "No se pudo iniciar el checkout." });
      setCheckoutLoading(false);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const { data } = await billingApi.portal();
      window.location.href = data.url;
    } catch (err) {
      setBanner({ type: "error", message: err.response?.data?.message ?? "No se pudo abrir el portal de suscripción." });
      setPortalLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Suscripción"
        description="Administrá el plan de tu clínica."
      />

      {banner && (
        <StatusBanner type={banner.type} onDismiss={() => setBanner(null)}>
          {banner.message}
        </StatusBanner>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : clinic ? (
        <>
          <CurrentPlanCard
            clinic={clinic}
            onManage={handlePortal}
            managing={portalLoading}
          />

          <div>
            <p className="mb-4 text-sm font-medium text-muted-foreground">Planes disponibles</p>
            <div className="grid gap-4 md:grid-cols-3">
              {PLANS.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  currentPlan={clinic.plan}
                  onUpgrade={handleUpgrade}
                  loading={checkoutLoading}
                />
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Los downgrades y cancelaciones se gestionan desde el{" "}
            <button
              className="underline hover:text-foreground transition-colors"
              onClick={handlePortal}
              disabled={portalLoading || !clinic.stripeCustomerId}
            >
              portal de Stripe
            </button>
            . Los cambios de plan toman efecto de inmediato.
          </p>
        </>
      ) : null}
    </div>
  );
};
