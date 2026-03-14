import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Pencil, PowerOff, FileText, Plus } from "lucide-react";
import { patientsApi } from "@/api/patients.api";
import { invoicesApi } from "@/api/invoices.api";
import { useToast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";

// ─── helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL  = { pending: "Pendiente", paid: "Pagado", overdue: "Vencido", canceled: "Cancelado" };
const STATUS_VARIANT = { pending: "secondary", paid: "success", overdue: "destructive", canceled: "outline" };

const fmtAmount = (amount, currency) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);

const fmtDate = (d) =>
  new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));

// ─── stat card ────────────────────────────────────────────────────────────────

const StatCard = ({ label, value, color }) => (
  <Card>
    <CardContent className="pt-5 pb-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${color ?? ""}`}>{value}</p>
    </CardContent>
  </Card>
);

// ─── page ─────────────────────────────────────────────────────────────────────

export const PatientDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [patient, setPatient] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [pRes, iRes] = await Promise.all([
          patientsApi.get(id),
          invoicesApi.list({ patientId: id, limit: 100 }),
        ]);
        setPatient(pRes.data.data);
        setInvoices(iRes.data.data);
      } catch {
        toast.error("No se pudo cargar el paciente");
        navigate("/patients");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]); // eslint-disable-line

  const openEdit = () => {
    setForm({
      name: patient.name,
      email: patient.email ?? "",
      phone: patient.phone ?? "",
      dni: patient.dni ?? "",
      notes: patient.notes ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await patientsApi.update(id, form);
      setPatient(data.data);
      setDialogOpen(false);
      toast.success("Paciente actualizado");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    try {
      const { data } = await patientsApi.toggleActive(id);
      setPatient(data.data);
      toast.success(data.data.isActive ? "Paciente activado" : "Paciente desactivado");
    } catch {
      toast.error("Error al cambiar estado");
    }
  };

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // Derived stats
  const totalInvoiced = invoices.reduce((s, inv) => s + (inv.currency === "ARS" ? inv.amount : 0), 0);
  const totalPaid = invoices.filter((i) => i.status === "paid").reduce((s, inv) => s + (inv.currency === "ARS" ? inv.amount : 0), 0);
  const totalOverdue = invoices.filter((i) => i.status === "overdue").reduce((s, inv) => s + (inv.currency === "ARS" ? inv.amount : 0), 0);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!patient) return null;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate("/patients")}
          className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Pacientes
        </button>
        <PageHeader
          title={patient.name}
          description={
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={patient.isActive ? "success" : "secondary"}>
                {patient.isActive ? "Activo" : "Inactivo"}
              </Badge>
              {patient.email && <span className="text-sm text-muted-foreground">{patient.email}</span>}
              {patient.phone && <span className="text-sm text-muted-foreground">{patient.phone}</span>}
              {patient.dni && <span className="text-sm text-muted-foreground">DNI {patient.dni}</span>}
            </div>
          }
          action={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleToggle}>
                <PowerOff className="h-3.5 w-3.5" />
                {patient.isActive ? "Desactivar" : "Activar"}
              </Button>
              <Button size="sm" onClick={openEdit}>
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
            </div>
          }
        />
      </div>

      {/* Notes */}
      {patient.notes && (
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">Notas clínicas</p>
            <p className="text-sm whitespace-pre-wrap">{patient.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total facturado (ARS)" value={fmtAmount(totalInvoiced, "ARS")} />
        <StatCard label="Total cobrado (ARS)" value={fmtAmount(totalPaid, "ARS")} color="text-emerald-600" />
        <StatCard label="Deuda vencida (ARS)" value={fmtAmount(totalOverdue, "ARS")} color={totalOverdue > 0 ? "text-red-600" : undefined} />
      </div>

      {/* Invoices table */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Cobros <span className="text-muted-foreground font-normal">({invoices.length})</span>
          </h2>
          <Link to="/invoices">
            <Button variant="outline" size="sm">
              <Plus className="h-3.5 w-3.5" /> Nuevo cobro
            </Button>
          </Link>
        </div>

        <div className="rounded-xl border bg-card">
          {invoices.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Sin cobros"
              description="Este paciente no tiene cobros registrados."
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Concepto</th>
                  <th className="px-4 py-3 font-medium">Importe</th>
                  <th className="px-4 py-3 font-medium">Vencimiento</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.map((inv) => (
                  <tr
                    key={inv._id}
                    className="hover:bg-muted/40 cursor-pointer transition-colors"
                    onClick={() => navigate(`/invoices/${inv._id}`)}
                  >
                    <td className="px-4 py-3 font-medium">{inv.concept}</td>
                    <td className="px-4 py-3 tabular-nums">{fmtAmount(inv.amount, inv.currency)}</td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{fmtDate(inv.dueDate)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[inv.status]}>{STATUS_LABEL[inv.status]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar paciente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave}>
            <DialogBody className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Nombre *</Label>
                <Input value={form.name ?? ""} onChange={set("name")} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email ?? ""} onChange={set("email")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Teléfono</Label>
                  <Input value={form.phone ?? ""} onChange={set("phone")} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>DNI</Label>
                <Input value={form.dni ?? ""} onChange={set("dni")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Notas</Label>
                <Textarea value={form.notes ?? ""} onChange={set("notes")} rows={3} />
              </div>
            </DialogBody>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
