import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users, FileText, X, ArrowRight } from "lucide-react";
import { patientsApi } from "@/api/patients.api";
import { invoicesApi } from "@/api/invoices.api";
import { cn } from "@/lib/utils";

const STATUS_LABEL = {
  pending: "Pendiente",
  paid: "Pagado",
  overdue: "Vencido",
  canceled: "Cancelado",
};

const STATUS_COLOR = {
  pending: "text-amber-600",
  paid: "text-emerald-600",
  overdue: "text-red-600",
  canceled: "text-slate-400",
};

// ─── result item ──────────────────────────────────────────────────────────────

const ResultItem = ({ icon, primary, secondary, badge, badgeColor, isSelected, onClick }) => {
  const Icon = icon;

  return (
  <button
    onClick={onClick}
    className={cn(
      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
      isSelected ? "bg-accent" : "hover:bg-accent/50",
    )}
  >
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
      <Icon className="h-4 w-4 text-muted-foreground" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate">{primary}</p>
      {secondary && <p className="text-xs text-muted-foreground truncate">{secondary}</p>}
    </div>
    {badge && (
      <span className={cn("text-xs font-medium shrink-0", badgeColor)}>{badge}</span>
    )}
    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
  </button>
  );
};

// ─── group header ─────────────────────────────────────────────────────────────

const GroupLabel = ({ children }) => (
  <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
    {children}
  </p>
);

// ─── main component ───────────────────────────────────────────────────────────

export const CommandPalette = ({ open, onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setPatients([]);
      setInvoices([]);
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setPatients([]);
      setInvoices([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const [pRes, iRes] = await Promise.all([
          patientsApi.list({ search: query, limit: 5 }),
          invoicesApi.list({ limit: 5 }),
        ]);
        setPatients(pRes.data.data);
        // Filter invoices client-side by concept (no full-text search on backend)
        const filtered = iRes.data.data.filter(
          (inv) =>
            inv.concept?.toLowerCase().includes(query.toLowerCase()) ||
            inv.patientId?.name?.toLowerCase().includes(query.toLowerCase()),
        );
        setInvoices(filtered.slice(0, 5));
        setSelectedIdx(0);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Flatten results for keyboard navigation
  const allResults = useMemo(() => [
    ...patients.map((p) => ({ type: "patient", item: p })),
    ...invoices.map((inv) => ({ type: "invoice", item: inv })),
  ], [patients, invoices]);

  const go = useCallback(
    (type, item) => {
      navigate(type === "patient" ? `/patients/${item._id}` : `/invoices/${item._id}`);
      onClose();
    },
    [navigate, onClose],
  );

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, allResults.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" && allResults[selectedIdx]) {
        const { type, item } = allResults[selectedIdx];
        go(type, item);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, allResults, selectedIdx, go, onClose]);

  if (!open) return null;

  const patientStartIdx = 0;
  const invoiceStartIdx = patients.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg rounded-xl border bg-card shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar pacientes, cobros…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {loading && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent shrink-0" />
          )}
          <button onClick={onClose} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2">
          {!query.trim() && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Escribí para buscar pacientes o cobros
            </p>
          )}

          {query.trim() && !loading && allResults.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sin resultados para "{query}"
            </p>
          )}

          {patients.length > 0 && (
            <>
              <GroupLabel>Pacientes</GroupLabel>
              {patients.map((p, i) => (
                <ResultItem
                  key={p._id}
                  icon={Users}
                  primary={p.name}
                  secondary={p.email ?? p.phone ?? p.dni ?? ""}
                  isSelected={selectedIdx === patientStartIdx + i}
                  onClick={() => go("patient", p)}
                />
              ))}
            </>
          )}

          {invoices.length > 0 && (
            <>
              <GroupLabel>Cobros</GroupLabel>
              {invoices.map((inv, i) => (
                <ResultItem
                  key={inv._id}
                  icon={FileText}
                  primary={inv.concept}
                  secondary={inv.patientId?.name ?? ""}
                  badge={STATUS_LABEL[inv.status]}
                  badgeColor={STATUS_COLOR[inv.status]}
                  isSelected={selectedIdx === invoiceStartIdx + i}
                  onClick={() => go("invoice", inv)}
                />
              ))}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t px-4 py-2 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span><kbd className="rounded border px-1 font-mono">↑↓</kbd> navegar</span>
          <span><kbd className="rounded border px-1 font-mono">↵</kbd> abrir</span>
          <span><kbd className="rounded border px-1 font-mono">Esc</kbd> cerrar</span>
        </div>
      </div>
    </div>
  );
};
