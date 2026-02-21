import { useState, useEffect, useCallback } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, FileText, CreditCard, Receipt, LogOut, Building2, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { invoicesApi } from "@/api/invoices.api";
import { CommandPalette } from "@/components/shared/CommandPalette";

// ─── nav item ─────────────────────────────────────────────────────────────────

const NavItem = ({ to, icon: Icon, label, end, badge }) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>
      cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
        isActive
          ? "bg-white/10 text-white"
          : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
      )
    }
  >
    <Icon className="h-4 w-4 shrink-0" />
    <span className="flex-1">{label}</span>
    {badge > 0 && (
      <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
        {badge > 99 ? "99+" : badge}
      </span>
    )}
  </NavLink>
);

// ─── layout ───────────────────────────────────────────────────────────────────

export const AppLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [overdueCount, setOverdueCount] = useState(0);
  const [cmdOpen, setCmdOpen] = useState(false);

  // Fetch overdue count once on mount
  useEffect(() => {
    invoicesApi
      .list({ status: "overdue", limit: 1 })
      .then(({ data }) => setOverdueCount(data.pagination?.total ?? 0))
      .catch(() => {});
  }, []);

  // ⌘K / Ctrl+K listener
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() ?? "U";

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col bg-[#0f172a]">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 px-4 border-b border-white/5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-white tracking-tight">ClinicPay</span>
        </div>

        {/* Search trigger */}
        <div className="px-3 pt-3">
          <button
            onClick={() => setCmdOpen(true)}
            className="flex w-full items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-sm text-slate-400 hover:bg-white/8 hover:text-slate-300 transition-colors"
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 text-left">Buscar…</span>
            <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-0.5 p-3 pt-2">
          <NavItem to="/" icon={LayoutDashboard} label="Dashboard" end />
          <NavItem to="/patients" icon={Users} label="Pacientes" />
          <NavItem to="/invoices" icon={FileText} label="Cobros" badge={overdueCount} />
          <NavItem to="/payments" icon={CreditCard} label="Pagos" />

          {user?.role === "clinic_admin" && (
            <>
              <div className="my-3 border-t border-white/5" />
              <NavItem to="/billing" icon={Receipt} label="Suscripción" />
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/5 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/5 group"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600/20 text-xs font-semibold text-indigo-400">
              {initials}
            </div>
            <div className="flex-1 text-left overflow-hidden">
              <p className="text-xs font-medium text-slate-200 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
            <LogOut className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-400 shrink-0" />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Command palette */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
};
