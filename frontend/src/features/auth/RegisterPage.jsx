import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { Building2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { authApi } from "@/api/auth.api";
import { useAuthStore } from "@/store/auth.store";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ─── step indicator ───────────────────────────────────────────────────────────

const STEPS = ["Tu clínica", "Tu cuenta"];

const StepIndicator = ({ current }) => (
  <div className="flex items-center gap-0">
    {STEPS.map((label, i) => {
      const done = i < current;
      const active = i === current;
      return (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                done && "bg-primary text-primary-foreground",
                active && "border-2 border-primary text-primary",
                !done && !active && "border-2 border-border text-muted-foreground",
              )}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-[11px] font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                "mx-3 mb-5 h-px w-16 transition-colors",
                done ? "bg-primary" : "bg-border",
              )}
            />
          )}
        </div>
      );
    })}
  </div>
);

// ─── field wrapper ────────────────────────────────────────────────────────────

const Field = ({ label, htmlFor, hint, children }) => (
  <div className="flex flex-col gap-1.5">
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

// ─── password input with toggle ───────────────────────────────────────────────

const PasswordInput = ({ id, value, onChange, placeholder, ...props }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="pr-9"
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
};

// ─── page ─────────────────────────────────────────────────────────────────────

const EMPTY = {
  clinicName: "",
  clinicEmail: "",
  name: "",
  email: "",
  password: "",
  confirm: "",
};

export const RegisterPage = () => {
  const { isAuthenticated } = useAuth();
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const set = (field) => (e) => {
    setError("");
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  // ── step 1 validation ──
  const handleStep1 = (e) => {
    e.preventDefault();
    if (!form.clinicName.trim()) { setError("El nombre de la clínica es obligatorio"); return; }
    if (!form.clinicEmail.trim()) { setError("El email de la clínica es obligatorio"); return; }
    setError("");
    setStep(1);
  };

  // ── step 2 + submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Tu nombre es obligatorio"); return; }
    if (!form.email.trim()) { setError("Tu email es obligatorio"); return; }
    if (form.password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres"); return; }
    if (form.password !== form.confirm) { setError("Las contraseñas no coinciden"); return; }

    setLoading(true);
    setError("");
    try {
      const { data } = await authApi.register({
        clinicName: form.clinicName.trim(),
        clinicEmail: form.clinicEmail.trim(),
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      setAuth(data.accessToken, data.user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message ?? "Error al crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-900/50">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">ClinicPay</h1>
          <p className="text-sm text-slate-400">Creá la cuenta de tu clínica</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {/* Stepper */}
            <div className="mb-6 flex justify-center">
              <StepIndicator current={step} />
            </div>

            {/* ── Step 1: clinic data ── */}
            {step === 0 && (
              <form onSubmit={handleStep1} className="flex flex-col gap-4">
                <Field label="Nombre de la clínica" htmlFor="clinicName">
                  <Input
                    id="clinicName"
                    value={form.clinicName}
                    onChange={set("clinicName")}
                    placeholder="Clínica San Martín"
                    autoFocus
                    required
                  />
                </Field>

                <Field
                  label="Email de contacto de la clínica"
                  htmlFor="clinicEmail"
                  hint="Se usa para comunicaciones institucionales y recordatorios."
                >
                  <Input
                    id="clinicEmail"
                    type="email"
                    value={form.clinicEmail}
                    onChange={set("clinicEmail")}
                    placeholder="contacto@clinica.com"
                    required
                  />
                </Field>

                {error && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full">
                  Continuar
                </Button>
              </form>
            )}

            {/* ── Step 2: admin account ── */}
            {step === 1 && (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Field label="Tu nombre completo" htmlFor="name">
                  <Input
                    id="name"
                    value={form.name}
                    onChange={set("name")}
                    placeholder="Dr. Martín López"
                    autoFocus
                    required
                  />
                </Field>

                <Field
                  label="Tu email"
                  htmlFor="email"
                  hint="Será tu usuario para iniciar sesión."
                >
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={set("email")}
                    placeholder="martin@clinica.com"
                    required
                  />
                </Field>

                <Field label="Contraseña" htmlFor="password" hint="Mínimo 8 caracteres.">
                  <PasswordInput
                    id="password"
                    value={form.password}
                    onChange={set("password")}
                    placeholder="••••••••"
                    required
                  />
                </Field>

                <Field label="Confirmar contraseña" htmlFor="confirm">
                  <PasswordInput
                    id="confirm"
                    value={form.confirm}
                    onChange={set("confirm")}
                    placeholder="••••••••"
                    required
                  />
                </Field>

                {error && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => { setError(""); setStep(0); }}
                    disabled={loading}
                  >
                    Atrás
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? "Creando cuenta…" : "Crear cuenta"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-sm text-slate-500">
          ¿Ya tenés cuenta?{" "}
          <Link to="/login" className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </div>
  );
};
