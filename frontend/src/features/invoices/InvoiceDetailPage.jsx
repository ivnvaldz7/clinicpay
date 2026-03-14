import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, XCircle, CreditCard, Trash2, Link2, Copy, ExternalLink, Loader2 } from "lucide-react";
import { invoicesApi } from "@/api/invoices.api";
import { paymentsApi } from "@/api/payments.api";
import { useAuthStore } from "@/store/auth.store";
import { useToast } from "@/hooks/useToast";
import { useConfirm } from "@/hooks/useConfirm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";

// ─── helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL   = { pending: "Pendiente", paid: "Pagado", overdue: "Vencido", canceled: "Cancelado" };
const STATUS_VARIANT = { pending: "secondary", paid: "success", overdue: "destructive", canceled: "outline" };

const METHOD_LABEL = { cash: "Efectivo", transfer: "Transferencia", stripe: "Stripe", mercadopago: "MercadoPago" };

const fmtAmount = (amount, currency) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);

const fmtDate = (d) =>
  new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));

const fmtDateTime = (d) =>
  new Intl.DateTimeFormat("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));

// ─── detail field ─────────────────────────────────────────────────────────────

const Field = ({ label, children }) => (
  <div>
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <div className="mt-0.5 text-sm">{children}</div>
  </div>
);

// ─── page ─────────────────────────────────────────────────────────────────────

export const InvoiceDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === "clinic_admin";

  const [invoice, setInvoice] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [paymentLink, setPaymentLink] = useState(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [invRes, payRes] = await Promise.all([
        invoicesApi.get(id),
        paymentsApi.list({ invoiceId: id, limit: 100 }),
      ]);
      setInvoice(invRes.data.data);
      setPayments(payRes.data.data);
    } catch {
      toast.error("No se pudo cargar el cobro");
      navigate("/invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line

  const handleStatus = async (status) => {
    setActionLoading(true);
    try {
      const { data } = await invoicesApi.updateStatus(id, status);
      setInvoice(data.data);
      toast.success(`Cobro marcado como ${STATUS_LABEL[status].toLowerCase()}`);
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Error al cambiar estado");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreatePaymentLink = async () => {
    setLinkLoading(true);
    try {
      const { data } = await invoicesApi.createPaymentLink(id);
      setPaymentLink(data.url);
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Error al generar el link");
    } finally {
      setLinkLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!paymentLink) return;
    await navigator.clipboard.writeText(paymentLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleDeletePayment = async (paymentId) => {
    const ok = await confirm({
      title: "¿Eliminar pago?",
      description: "El cobro puede revertir a pendiente. Esta acción no se puede deshacer.",
    });
    if (!ok) return;
    try {
      await paymentsApi.delete(paymentId);
      toast.success("Pago eliminado");
      load();
    } catch {
      toast.error("Error al eliminar el pago");
    }
  };

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!invoice) return null;

  const patient = invoice.patientId;
  const remaining = invoice.amount - totalPaid;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Back */}
      <div>
        <button
          onClick={() => navigate("/invoices")}
          className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Cobros
        </button>

        <PageHeader
          title={invoice.concept}
          description={
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[invoice.status]}>{STATUS_LABEL[invoice.status]}</Badge>
              <span className="text-sm text-muted-foreground">
                {patient?.name ?? "—"}
              </span>
            </div>
          }
          action={
            <div className="flex gap-2">
              {invoice.status === "pending" && (
                <Button
                  size="sm"
                  onClick={() => handleStatus("paid")}
                  disabled={actionLoading}
                >
                  <CheckCircle className="h-3.5 w-3.5" /> Marcar como pagado
                </Button>
              )}
              {isAdmin && invoice.status !== "canceled" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStatus("canceled")}
                  disabled={actionLoading}
                >
                  <XCircle className="h-3.5 w-3.5" /> Cancelar
                </Button>
              )}
            </div>
          }
        />
      </div>

      {/* Invoice details */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Field label="Importe total">
              <span className="text-base font-bold">{fmtAmount(invoice.amount, invoice.currency)}</span>
            </Field>
            <Field label="Total cobrado">
              <span className="font-semibold text-emerald-600">{fmtAmount(totalPaid, invoice.currency)}</span>
            </Field>
            <Field label="Saldo pendiente">
              <span className={remaining > 0 ? "font-semibold text-amber-600" : "text-muted-foreground"}>
                {fmtAmount(remaining, invoice.currency)}
              </span>
            </Field>
            <Field label="Vencimiento">
              <span>{fmtDate(invoice.dueDate)}</span>
            </Field>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3 border-t pt-6">
            <Field label="Paciente">
              {patient ? (
                <button
                  onClick={() => navigate(`/patients/${patient._id}`)}
                  className="font-medium text-primary hover:underline"
                >
                  {patient.name}
                </button>
              ) : "—"}
            </Field>
            {patient?.email && <Field label="Email paciente">{patient.email}</Field>}
            <Field label="Fecha de creación">{fmtDateTime(invoice.createdAt)}</Field>
            {invoice.paidAt && <Field label="Fecha de pago">{fmtDateTime(invoice.paidAt)}</Field>}
          </div>
        </CardContent>
      </Card>

      {/* Payment link */}
      {invoice.status !== "paid" && invoice.status !== "canceled" && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Link de pago Stripe</h2>
            </div>

            {paymentLink ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={paymentLink}
                    className="flex-1 rounded-md border bg-muted/40 px-3 py-1.5 text-sm font-mono truncate outline-none"
                  />
                  <Button size="sm" variant="outline" onClick={handleCopyLink}>
                    <Copy className="h-3.5 w-3.5" />
                    {linkCopied ? "¡Copiado!" : "Copiar"}
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={paymentLink} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" /> Abrir
                    </a>
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-xs text-muted-foreground">El link expira en 24 horas.</p>
                  <Button size="sm" variant="ghost" className="h-auto p-0 text-xs" onClick={handleCreatePaymentLink} disabled={linkLoading}>
                    Regenerar link
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" onClick={handleCreatePaymentLink} disabled={linkLoading}>
                {linkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                Generar link de pago
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payments */}
      <div>
        <h2 className="mb-3 text-sm font-semibold">
          Pagos registrados <span className="text-muted-foreground font-normal">({payments.length})</span>
        </h2>

        <div className="rounded-xl border bg-card">
          {payments.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="Sin pagos"
              description="No hay pagos registrados para este cobro."
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Importe</th>
                  <th className="px-4 py-3 font-medium">Método</th>
                  <th className="px-4 py-3 font-medium">Notas</th>
                  {isAdmin && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map((pay) => (
                  <tr key={pay._id} className="group hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                      {fmtDateTime(pay.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {fmtAmount(pay.amount, pay.currency)}
                    </td>
                    <td className="px-4 py-3">{METHOD_LABEL[pay.method]}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                      {pay.notes ?? "—"}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleDeletePayment(pay._id)}
                            className="rounded p-1 hover:bg-destructive/10"
                            title="Eliminar pago"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
