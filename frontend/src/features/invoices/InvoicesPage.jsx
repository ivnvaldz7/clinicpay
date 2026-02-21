import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FileText, Trash2, CheckCircle, XCircle, Download } from "lucide-react";
import { invoicesApi } from "@/api/invoices.api";
import { patientsApi } from "@/api/patients.api";
import { useAuthStore } from "@/store/auth.store";
import { useToast } from "@/hooks/useToast";
import { useConfirm } from "@/hooks/useConfirm";
import { exportToCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { Combobox } from "@/components/shared/Combobox";

// ─── helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABEL = { pending: "Pendiente", paid: "Pagado", overdue: "Vencido", canceled: "Cancelado" };
const STATUS_VARIANT = { pending: "secondary", paid: "success", overdue: "destructive", canceled: "outline" };

const fmtAmount = (amount, currency) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);

const fmtDate = (d) =>
  new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));

const todayISO = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM = { patient: null, concept: "", amount: "", currency: "ARS", dueDate: todayISO() };

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <Label>{label}</Label>
    {children}
  </div>
);

const TableSkeleton = () => (
  <div className="divide-y">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 px-4 py-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    ))}
  </div>
);

// ─── component ───────────────────────────────────────────────────────────────

export const InvoicesPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === "clinic_admin";

  const [invoices, setInvoices] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 });
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      const { data } = await invoicesApi.list(params);
      setInvoices(data.data);
      setPagination(data.pagination);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(1); }, [load]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setDialogOpen(true);
  };

  const searchPatients = useCallback(async (query) => {
    const { data } = await patientsApi.list({ search: query, active: "true", limit: 10 });
    return data.data.map((p) => ({ _id: p._id, label: p.name, sublabel: p.email ?? p.dni ?? "" }));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.patient) { setFormError("Seleccioná un paciente"); return; }
    if (!form.amount || Number(form.amount) <= 0) { setFormError("El importe debe ser mayor a 0"); return; }
    setSaving(true);
    setFormError("");
    try {
      await invoicesApi.create({
        patientId: form.patient._id,
        concept: form.concept,
        amount: Number(form.amount),
        currency: form.currency,
        dueDate: form.dueDate,
      });
      toast.success("Cobro creado");
      setDialogOpen(false);
      load(1);
    } catch (err) {
      setFormError(err.response?.data?.message ?? "Error al crear el cobro");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (e, invoice, status) => {
    e.stopPropagation();
    try {
      await invoicesApi.updateStatus(invoice._id, status);
      toast.success(`Cobro marcado como ${STATUS_LABEL[status].toLowerCase()}`);
      load(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Error al cambiar estado");
    }
  };

  const handleDelete = async (e, invoice) => {
    e.stopPropagation();
    const ok = await confirm({
      title: "¿Eliminar cobro?",
      description: `"${invoice.concept}" será eliminado permanentemente.`,
    });
    if (!ok) return;
    try {
      await invoicesApi.delete(invoice._id);
      toast.success("Cobro eliminado");
      load(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message ?? "Error al eliminar");
    }
  };

  const handleExport = () => {
    exportToCsv(`cobros-${new Date().toISOString().slice(0, 10)}.csv`, invoices, [
      { label: "Paciente",     getValue: (inv) => inv.patientId?.name ?? "" },
      { label: "Concepto",     getValue: (inv) => inv.concept },
      { label: "Importe",      getValue: (inv) => inv.amount },
      { label: "Moneda",       getValue: (inv) => inv.currency },
      { label: "Vencimiento",  getValue: (inv) => fmtDate(inv.dueDate) },
      { label: "Estado",       getValue: (inv) => STATUS_LABEL[inv.status] },
    ]);
    toast.success("Exportado correctamente");
  };

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Cobros"
        description={`${pagination.total} factura${pagination.total !== 1 ? "s" : ""}`}
        action={
          <div className="flex gap-2">
            {invoices.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4" /> Exportar
              </Button>
            )}
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Nuevo cobro
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40">
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="paid">Pagado</option>
          <option value="overdue">Vencido</option>
          <option value="canceled">Cancelado</option>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card">
        {loading ? (
          <TableSkeleton />
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Sin cobros"
            description="Registrá el primer cobro para un paciente."
            action={<Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> Nuevo cobro</Button>}
          />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Paciente</th>
                  <th className="px-4 py-3 font-medium">Concepto</th>
                  <th className="px-4 py-3 font-medium">Importe</th>
                  <th className="px-4 py-3 font-medium">Vencimiento</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.map((inv) => (
                  <tr
                    key={inv._id}
                    className="group hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() => navigate(`/invoices/${inv._id}`)}
                  >
                    <td className="px-4 py-3 font-medium">{inv.patientId?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{inv.concept}</td>
                    <td className="px-4 py-3 font-medium tabular-nums">{fmtAmount(inv.amount, inv.currency)}</td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{fmtDate(inv.dueDate)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[inv.status]}>{STATUS_LABEL[inv.status]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {inv.status === "pending" && (
                          <button title="Marcar como pagado" onClick={(e) => handleStatusChange(e, inv, "paid")} className="rounded p-1 hover:bg-accent">
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                          </button>
                        )}
                        {isAdmin && inv.status !== "canceled" && (
                          <button title="Cancelar cobro" onClick={(e) => handleStatusChange(e, inv, "canceled")} className="rounded p-1 hover:bg-accent">
                            <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        )}
                        {isAdmin && ["pending", "canceled"].includes(inv.status) && (
                          <button title="Eliminar" onClick={(e) => handleDelete(e, inv)} className="rounded p-1 hover:bg-destructive/10">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        )}
                      </div>
                    </td>
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

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo cobro</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <DialogBody className="flex flex-col gap-4">
              <Field label="Paciente *">
                <Combobox
                  onSearch={searchPatients}
                  value={form.patient}
                  onChange={(p) => setForm((f) => ({ ...f, patient: p }))}
                  placeholder="Buscar paciente…"
                />
              </Field>
              <Field label="Concepto *">
                <Input value={form.concept} onChange={set("concept")} placeholder="Consulta, estudio, tratamiento…" required />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Importe *">
                  <Input type="number" min="0" step="0.01" value={form.amount} onChange={set("amount")} placeholder="0.00" required />
                </Field>
                <Field label="Moneda">
                  <Select value={form.currency} onChange={set("currency")}>
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </Select>
                </Field>
              </div>
              <Field label="Vencimiento *">
                <Input type="date" value={form.dueDate} onChange={set("dueDate")} required />
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
                {saving ? "Creando…" : "Crear cobro"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
