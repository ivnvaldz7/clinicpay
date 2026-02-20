import { useState, useEffect, useCallback } from "react";
import { Plus, CreditCard, Trash2 } from "lucide-react";
import { paymentsApi } from "@/api/payments.api";
import { invoicesApi } from "@/api/invoices.api";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { Combobox } from "@/components/shared/Combobox";

// ─── helpers ─────────────────────────────────────────────────────────────────

const METHOD_LABEL = {
  cash: "Efectivo",
  transfer: "Transferencia",
  stripe: "Stripe",
  mercadopago: "MercadoPago",
};

const METHOD_VARIANT = {
  cash: "secondary",
  transfer: "secondary",
  stripe: "default",
  mercadopago: "default",
};

const fmtAmount = (amount, currency) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);

const fmtDate = (d) =>
  new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(d));

const EMPTY_FORM = { invoice: null, amount: "", method: "cash", notes: "" };

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <Label>{label}</Label>
    {children}
  </div>
);

// ─── component ───────────────────────────────────────────────────────────────

export const PaymentsPage = () => {
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === "clinic_admin";

  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 });
  const [methodFilter, setMethodFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (methodFilter) params.method = methodFilter;
      const { data } = await paymentsApi.list(params);
      setPayments(data.data);
      setPagination(data.pagination);
    } finally {
      setLoading(false);
    }
  }, [methodFilter]);

  useEffect(() => { load(1); }, [load]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setDialogOpen(true);
  };

  const searchInvoices = useCallback(async (query) => {
    const { data } = await invoicesApi.list({
      limit: 10,
      // Backend full-text search not available for invoices — list pending/overdue
      // and let user identify by patient name + concept shown as sublabel
    });
    return data.data
      .filter(
        (inv) =>
          ["pending", "overdue"].includes(inv.status) &&
          (!query ||
            inv.patientId?.name?.toLowerCase().includes(query.toLowerCase()) ||
            inv.concept?.toLowerCase().includes(query.toLowerCase())),
      )
      .map((inv) => ({
        _id: inv._id,
        label: inv.concept,
        sublabel: `${inv.patientId?.name ?? ""} · ${fmtAmount(inv.amount, inv.currency)}`,
        amount: inv.amount,
      }));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.invoice) { setFormError("Seleccioná un cobro"); return; }
    if (!form.amount || Number(form.amount) <= 0) { setFormError("El importe debe ser mayor a 0"); return; }
    setSaving(true);
    setFormError("");
    try {
      await paymentsApi.create({
        invoiceId: form.invoice._id,
        amount: Number(form.amount),
        method: form.method,
        notes: form.notes || undefined,
      });
      setDialogOpen(false);
      load(1);
    } catch (err) {
      setFormError(err.response?.data?.message ?? "Error al registrar el pago");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (payment) => {
    if (!confirm("¿Eliminar este pago? El cobro asociado puede revertir a pendiente.")) return;
    try {
      await paymentsApi.delete(payment._id);
      load(pagination.page);
    } catch (err) {
      alert(err.response?.data?.message ?? "Error al eliminar");
    }
  };

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // When an invoice is selected, prefill the amount
  const handleInvoiceSelect = (inv) => {
    setForm((f) => ({ ...f, invoice: inv, amount: inv.amount?.toString() ?? "" }));
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Pagos"
        description={`${pagination.total} pago${pagination.total !== 1 ? "s" : ""} registrado${pagination.total !== 1 ? "s" : ""}`}
        action={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Registrar pago
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="w-44">
          <option value="">Todos los métodos</option>
          <option value="cash">Efectivo</option>
          <option value="transfer">Transferencia</option>
          <option value="stripe">Stripe</option>
          <option value="mercadopago">MercadoPago</option>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : payments.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="Sin pagos"
            description="Registrá un pago asociado a un cobro existente."
            action={<Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> Registrar pago</Button>}
          />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Paciente</th>
                  <th className="px-4 py-3 font-medium">Cobro</th>
                  <th className="px-4 py-3 font-medium">Importe</th>
                  <th className="px-4 py-3 font-medium">Método</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  {isAdmin && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map((pay) => (
                  <tr key={pay._id} className="group hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {pay.patientId?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                      {pay.invoiceId?.concept ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {fmtAmount(pay.amount, pay.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={METHOD_VARIANT[pay.method]}>
                        {METHOD_LABEL[pay.method]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                      {fmtDate(pay.createdAt)}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            title="Eliminar pago"
                            onClick={() => handleDelete(pay)}
                            className="rounded p-1 hover:bg-destructive/10"
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
            <div className="border-t px-4 py-3">
              <Pagination {...pagination} onPage={(p) => load(p)} />
            </div>
          </>
        )}
      </div>

      {/* Register payment dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <DialogBody className="flex flex-col gap-4">
              <Field label="Cobro *">
                <Combobox
                  onSearch={searchInvoices}
                  value={form.invoice}
                  onChange={handleInvoiceSelect}
                  placeholder="Buscar cobro pendiente…"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Importe *">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={set("amount")}
                    placeholder="0.00"
                    required
                  />
                </Field>
                <Field label="Método *">
                  <Select value={form.method} onChange={set("method")}>
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                    <option value="stripe">Stripe</option>
                    <option value="mercadopago">MercadoPago</option>
                  </Select>
                </Field>
              </div>
              <Field label="Notas">
                <Textarea
                  value={form.notes}
                  onChange={set("notes")}
                  placeholder="Número de comprobante, referencia…"
                  rows={2}
                />
              </Field>
              {formError && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>
              )}
            </DialogBody>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={saving}>
                {saving ? "Registrando…" : "Registrar pago"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
