import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, AlertCircle, Clock, Users } from "lucide-react";
import { dashboardApi } from "@/api/dashboard.api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const fmt = (n) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n ?? 0);

const KpiCard = ({ title, amount, count, icon, badgeVariant }) => {
  const Icon = icon;

  return (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <p className="text-2xl font-bold">{fmt(amount)}</p>
      <Badge variant={badgeVariant} className="mt-1">
        {count} {count === 1 ? "factura" : "facturas"}
      </Badge>
    </CardContent>
  </Card>
  );
};

export const DashboardPage = () => {
  const [summary, setSummary] = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
      const to = now.toISOString();

      const [summaryRes, revenueRes] = await Promise.all([
        dashboardApi.summary(),
        dashboardApi.revenue({ from, to, groupBy: "month" }),
      ]);
      setSummary(summaryRes.data.data);
      setRevenue(revenueRes.data.data);
      setLoading(false);
    };
    load().catch(console.error);
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          title="Cobrado"
          amount={summary?.collected.amount}
          count={summary?.collected.count}
          icon={TrendingUp}
          badgeVariant="success"
        />
        <KpiCard
          title="Pendiente"
          amount={summary?.pending.amount}
          count={summary?.pending.count}
          icon={Clock}
          badgeVariant="secondary"
        />
        <KpiCard
          title="Vencido"
          amount={summary?.overdue.amount}
          count={summary?.overdue.count}
          icon={AlertCircle}
          badgeVariant="destructive"
        />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pacientes activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary?.patients.total ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ingresos por mes</CardTitle>
        </CardHeader>
        <CardContent>
          {revenue.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sin pagos registrados en los últimos 6 meses.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={revenue} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(221.2 83.2% 53.3%)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(221.2 83.2% 53.3%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214.3 31.8% 91.4%)" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                />
                <Tooltip
                  formatter={(value) => [fmt(value), "Cobrado"]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="hsl(221.2 83.2% 53.3%)"
                  strokeWidth={2}
                  fill="url(#colorAmount)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
