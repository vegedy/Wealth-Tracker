import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";

const CHART_COLORS = [
  "hsl(183, 55%, 42%)",  // teal
  "hsl(20, 60%, 55%)",   // terra
  "hsl(188, 55%, 38%)",  // dark teal
  "hsl(43, 74%, 60%)",   // gold
  "hsl(320, 45%, 58%)",  // mauve
  "hsl(103, 43%, 47%)",  // green
  "hsl(262, 50%, 58%)",  // purple
  "hsl(27, 70%, 55%)",   // orange
];

type TimeRange = "7d" | "1m" | "3m" | "6m" | "1y" | "all";

function getDateRange(range: TimeRange): { from: string; to: string } {
  const to = new Date().toISOString().slice(0, 10);
  const d = new Date();
  switch (range) {
    case "7d": d.setDate(d.getDate() - 7); break;
    case "1m": d.setMonth(d.getMonth() - 1); break;
    case "3m": d.setMonth(d.getMonth() - 3); break;
    case "6m": d.setMonth(d.getMonth() - 6); break;
    case "1y": d.setFullYear(d.getFullYear() - 1); break;
    case "all": return { from: "2020-01-01", to };
  }
  return { from: d.toISOString().slice(0, 10), to };
}

function formatEur(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>("6m");
  const { from, to } = useMemo(() => getDateRange(timeRange), [timeRange]);

  const { data: tsData, isLoading: tsLoading } = useQuery<{
    areaSeries: { areaId: number; areaName: string; series: { date: string; value: number }[] }[];
    totalSeries: { date: string; value: number }[];
  }>({
    queryKey: ["/api/timeseries", `?from=${from}&to=${to}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/timeseries?from=${from}&to=${to}`);
      return res.json();
    },
  });

  const { data: areaDistribution } = useQuery<{ areaId: number; areaName: string; value: number; percent: number }[]>({
    queryKey: ["/api/distribution/areas", `?date=${to}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/distribution/areas?date=${to}`);
      return res.json();
    },
  });

  // Compute KPI values
  const totalNow = tsData?.totalSeries?.[tsData.totalSeries.length - 1]?.value ?? 0;
  const totalStart = tsData?.totalSeries?.[0]?.value ?? 0;
  const change = totalNow - totalStart;
  const changePct = totalStart > 0 ? (change / totalStart) * 100 : 0;

  // Prepare line chart data: merge all areas + total into a single dataset keyed by date
  const lineData = useMemo(() => {
    if (!tsData) return [];
    const map = new Map<string, Record<string, number>>();
    for (const pt of tsData.totalSeries) {
      const entry = map.get(pt.date) || { date: pt.date as any };
      entry["Gesamt"] = pt.value;
      map.set(pt.date, entry);
    }
    for (const as of tsData.areaSeries) {
      for (const pt of as.series) {
        const entry = map.get(pt.date) || { date: pt.date as any };
        entry[as.areaName] = pt.value;
        map.set(pt.date, entry);
      }
    }
    return Array.from(map.values()).sort((a, b) => (a.date as string).localeCompare(b.date as string));
  }, [tsData]);

  const areaNames = tsData?.areaSeries?.map((a) => a.areaName) ?? [];

  // Downsample for performance: max ~120 points
  const sampledLineData = useMemo(() => {
    if (lineData.length <= 120) return lineData;
    const step = Math.ceil(lineData.length / 120);
    return lineData.filter((_, i) => i % step === 0 || i === lineData.length - 1);
  }, [lineData]);

  const timeRanges: { value: TimeRange; label: string }[] = [
    { value: "7d", label: "7 Tage" },
    { value: "1m", label: "1 Monat" },
    { value: "3m", label: "3 Monate" },
    { value: "6m", label: "6 Monate" },
    { value: "1y", label: "1 Jahr" },
    { value: "all", label: "Gesamt" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-y-auto h-full">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-total-value">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gesamtvermögen</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {tsLoading ? (
              <Skeleton className="h-8 w-40" />
            ) : (
              <div className="text-xl font-bold tabular-nums" data-testid="text-total-value">
                {formatEur(totalNow)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-change-abs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Veränderung (abs.)</CardTitle>
            {change >= 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
          </CardHeader>
          <CardContent>
            {tsLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className={`text-xl font-bold tabular-nums ${change >= 0 ? "text-green-500" : "text-red-500"}`} data-testid="text-change-abs">
                {change >= 0 ? "+" : ""}{formatEur(change)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-change-pct">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Veränderung (%)</CardTitle>
            {changePct >= 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
          </CardHeader>
          <CardContent>
            {tsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className={`text-xl font-bold tabular-nums ${changePct >= 0 ? "text-green-500" : "text-red-500"}`} data-testid="text-change-pct">
                {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Time range selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {timeRanges.map((tr) => (
          <Button
            key={tr.value}
            variant={timeRange === tr.value ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange(tr.value)}
            data-testid={`button-range-${tr.value}`}
          >
            {tr.label}
          </Button>
        ))}
      </div>

      {/* Line chart: total + per area */}
      <Card data-testid="card-line-chart">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Wertverlauf (EUR)</CardTitle>
        </CardHeader>
        <CardContent>
          {tsLoading ? (
            <Skeleton className="h-[320px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={sampledLineData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: 12,
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value: number) => [formatEur(value), undefined]}
                  labelFormatter={(label) => new Date(label).toLocaleDateString("de-DE")}
                />
                <Legend />
                <Line type="monotone" dataKey="Gesamt" stroke="hsl(var(--foreground))" strokeWidth={2.5} dot={false} />
                {areaNames.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={1.5}
                    dot={false}
                    strokeDasharray={undefined}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Area distribution donut */}
      <Card data-testid="card-area-distribution">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Verteilung nach Bereich</CardTitle>
        </CardHeader>
        <CardContent>
          {!areaDistribution ? (
            <Skeleton className="h-[280px] w-full" />
          ) : (
            <div className="flex flex-col md:flex-row items-center gap-6">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={areaDistribution.filter((d) => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="areaName"
                  >
                    {areaDistribution.filter((d) => d.value > 0).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: 12,
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(value: number, name: string) => [formatEur(value), name]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 min-w-[180px]">
                {areaDistribution.filter((d) => d.value > 0).map((d, i) => (
                  <div key={d.areaId} className="flex items-center gap-2 text-sm">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="text-muted-foreground flex-1">{d.areaName}</span>
                    <span className="font-medium tabular-nums">{d.percent.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
