import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, PowerOff, Trash2, Users } from "lucide-react";
import { patientsApi } from "@/api/patients.api";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";

const EMPTY_FORM = { name: "", email: "", phone: "", dni: "", notes: "" };

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <Label>{label}</Label>
    {children}
  </div>
);

export const PatientsPage = () => {
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === "clinic_admin";

  const [patients, setPatients] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 });
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null); // Patient object | null
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (activeFilter !== "") params.active = activeFilter;
      const { data } = await patientsApi.list(params);
      setPatients(data.data);
      setPagination(data.pagination);
    } finally {
      setLoading(false);
    }
  }, [search, activeFilter]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => load(1), 300);
    return () => clearTimeout(t);
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setDialogOpen(true);
  };

  const openEdit = (patient) => {
    setEditing(patient);
    setForm({
      name: patient.name,
      email: patient.email ?? "",
      phone: patient.phone ?? "",
      dni: patient.dni ?? "",
      notes: patient.notes ?? "",
    });
    setFormError("");
    setDialogOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        await patientsApi.update(editing._id, form);
      } else {
        await patientsApi.create(form);
      }
      setDialogOpen(false);
      load(pagination.page);
    } catch (err) {
      setFormError(err.response?.data?.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (patient) => {
    await patientsApi.toggleActive(patient._id);
    load(pagination.page);
  };

  const handleDelete = async (patient) => {
    if (!confirm(`¿Eliminar a ${patient.name}? Esta acción no se puede deshacer.`)) return;
    await patientsApi.delete(patient._id);
    load(pagination.page);
  };

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Pacientes"
        description={`${pagination.total} paciente${pagination.total !== 1 ? "s" : ""} registrado${pagination.total !== 1 ? "s" : ""}`}
        action={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nuevo paciente
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Buscar por nombre, email o DNI…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-72"
        />
        <Select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} className="w-36">
          <option value="">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : patients.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Sin pacientes"
            description="Registrá el primer paciente para comenzar."
            action={<Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> Nuevo paciente</Button>}
          />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Teléfono</th>
                  <th className="px-4 py-3 font-medium">DNI</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {patients.map((p) => (
                  <tr key={p._id} className="group hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.email ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.dni ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={p.isActive ? "success" : "secondary"}>
                        {p.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          title="Editar"
                          onClick={() => openEdit(p)}
                          className="rounded p-1 hover:bg-accent"
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button
                          title={p.isActive ? "Desactivar" : "Activar"}
                          onClick={() => handleToggle(p)}
                          className="rounded p-1 hover:bg-accent"
                        >
                          <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        {isAdmin && (
                          <button
                            title="Eliminar"
                            onClick={() => handleDelete(p)}
                            className="rounded p-1 hover:bg-destructive/10"
                          >
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

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar paciente" : "Nuevo paciente"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave}>
            <DialogBody className="flex flex-col gap-4">
              <Field label="Nombre *">
                <Input value={form.name} onChange={set("name")} placeholder="María García" required />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Email">
                  <Input type="email" value={form.email} onChange={set("email")} placeholder="maria@email.com" />
                </Field>
                <Field label="Teléfono">
                  <Input value={form.phone} onChange={set("phone")} placeholder="+54 11 1234-5678" />
                </Field>
              </div>
              <Field label="DNI">
                <Input value={form.dni} onChange={set("dni")} placeholder="12.345.678" />
              </Field>
              <Field label="Notas">
                <Textarea value={form.notes} onChange={set("notes")} placeholder="Observaciones clínicas, alergias…" rows={3} />
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
                {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear paciente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
