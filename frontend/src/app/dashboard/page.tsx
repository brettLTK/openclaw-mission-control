"use client";

export const dynamic = "force-dynamic";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { SignedIn, SignedOut, useAuth } from "@/auth/clerk";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, PenSquare, Timer, Users } from "lucide-react";

import { DashboardSidebar } from "@/components/organisms/DashboardSidebar";
import { DashboardShell } from "@/components/templates/DashboardShell";
import DropdownSelect from "@/components/ui/dropdown-select";
import { SignedOutPanel } from "@/components/auth/SignedOutPanel";
import { ApiError } from "@/api/mutator";
import {
  type dashboardMetricsApiV1MetricsDashboardGetResponse,
  useDashboardMetricsApiV1MetricsDashboardGet,
} from "@/api/generated/metrics/metrics";
import type { DashboardMetricsApiV1MetricsDashboardGetRangeKey } from "@/api/generated/model/dashboardMetricsApiV1MetricsDashboardGetRangeKey";
import { parseApiDatetime } from "@/lib/datetime";

type RangeKey = DashboardMetricsApiV1MetricsDashboardGetRangeKey;
type BucketKey = "hour" | "day" | "week" | "month";

type SeriesPoint = {
  period: string;
  value: number;
};

type WipPoint = {
  period: string;
  inbox: number;
  in_progress: number;
  review: number;
  done: number;
};

type RangeSeries = {
  range: RangeKey;
  bucket: BucketKey;
  points: SeriesPoint[];
};

type WipRangeSeries = {
  range: RangeKey;
  bucket: BucketKey;
  points: WipPoint[];
};

const hourFormatter = new Intl.DateTimeFormat("en-US", { hour: "numeric" });
const dayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});
const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
});

const DASHBOARD_RANGE_OPTIONS: Array<{ value: RangeKey; label: string }> = [
  { value: "24h", label: "24 hours" },
  { value: "3d", label: "3 days" },
  { value: "7d", label: "7 days" },
  { value: "14d", label: "14 days" },
  { value: "1m", label: "1 month" },
  { value: "3m", label: "3 months" },
  { value: "6m", label: "6 months" },
  { value: "1y", label: "1 year" },
];
const DASHBOARD_RANGE_SET = new Set<RangeKey>(
  DASHBOARD_RANGE_OPTIONS.map((option) => option.value),
);
const DEFAULT_RANGE: RangeKey = "7d";

const formatPeriod = (value: string, bucket: BucketKey) => {
  const date = parseApiDatetime(value);
  if (!date) return "";
  if (bucket === "hour") return hourFormatter.format(date);
  if (bucket === "month") return monthFormatter.format(date);
  return dayFormatter.format(date);
};

const formatNumber = (value: number) => value.toLocaleString("en-US");
const formatPercent = (value: number) => `${value.toFixed(1)}%`;
const formatHours = (value: number | null) =>
  value === null || !Number.isFinite(value) ? "--" : `${value.toFixed(1)}h`;
const calcProgress = (values?: number[]) => {
  if (!values || values.length === 0) return 0;
  const max = Math.max(...values);
  if (!Number.isFinite(max) || max <= 0) return 0;
  const latest = values[values.length - 1] ?? 0;
  return Math.max(0, Math.min(100, Math.round((latest / max) * 100)));
};

function buildSeries(series: RangeSeries) {
  return series.points.map((point) => ({
    period: formatPeriod(point.period, series.bucket),
    value: Number(point.value ?? 0),
  }));
}

function buildWipSeries(series: WipRangeSeries) {
  return series.points.map((point) => ({
    period: formatPeriod(point.period, series.bucket),
    inbox: Number(point.inbox ?? 0),
    in_progress: Number(point.in_progress ?? 0),
    review: Number(point.review ?? 0),
    done: Number(point.done ?? 0),
  }));
}

function buildSparkline(series: RangeSeries) {
  return {
    values: series.points.map((point) => Number(point.value ?? 0)),
    labels: series.points.map((point) =>
      formatPeriod(point.period, series.bucket),
    ),
    bucket: series.bucket,
  };
}

function buildWipSparkline(series: WipRangeSeries, key: keyof WipPoint) {
  return {
    values: series.points.map((point) => Number(point[key] ?? 0)),
    labels: series.points.map((point) =>
      formatPeriod(point.period, series.bucket),
    ),
    bucket: series.bucket,
  };
}

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; color?: string }>;
  label?: string;
  formatter?: (value: number, name?: string) => string;
};

function TooltipCard({ active, payload, label, formatter }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-slate-900/95 px-3 py-2 text-xs text-slate-200 shadow-lg">
      {label ? <div className="text-slate-400">Period: {label}</div> : null}
      <div className="mt-1 space-y-1">
        {payload.map((entry, index) => (
          <div
            key={`${entry.name ?? "value"}-${index}`}
            className="flex items-center justify-between gap-3"
          >
            <span className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name ?? "Value"}
            </span>
            <span className="font-semibold text-slate-100">
              <span className="text-slate-400">Value: </span>
              {formatter
                ? formatter(Number(entry.value ?? 0), entry.name)
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sublabel,
  icon,
  progress = 0,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: React.ReactNode;
  progress?: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <div className="rounded-lg bg-blue-50 p-2 text-blue-600">{icon}</div>
      </div>
      <div className="flex items-end gap-2">
        <h3 className="font-heading text-4xl font-bold text-slate-900">
          {value}
        </h3>
      </div>
      {sublabel ? (
        <p className="mt-2 text-xs text-slate-500">{sublabel}</p>
      ) : null}
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="font-heading text-base font-semibold text-slate-900">
            {title}
          </h3>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="h-56">{children}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { isSignedIn } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedRangeParam = searchParams.get("range");
  const selectedRange: RangeKey =
    selectedRangeParam &&
    DASHBOARD_RANGE_SET.has(selectedRangeParam as RangeKey)
      ? (selectedRangeParam as RangeKey)
      : DEFAULT_RANGE;
  const metricsQuery = useDashboardMetricsApiV1MetricsDashboardGet<
    dashboardMetricsApiV1MetricsDashboardGetResponse,
    ApiError
  >(
    { range_key: selectedRange },
    {
      query: {
        enabled: Boolean(isSignedIn),
        refetchInterval: 15_000,
        refetchOnMount: "always",
      },
    },
  );

  const metrics =
    metricsQuery.data?.status === 200 ? metricsQuery.data.data : null;

  const throughputSeries = useMemo(
    () => (metrics ? buildSeries(metrics.throughput.primary) : []),
    [metrics],
  );
  const cycleSeries = useMemo(
    () => (metrics ? buildSeries(metrics.cycle_time.primary) : []),
    [metrics],
  );
  const errorSeries = useMemo(
    () => (metrics ? buildSeries(metrics.error_rate.primary) : []),
    [metrics],
  );
  const wipSeries = useMemo(
    () => (metrics ? buildWipSeries(metrics.wip.primary) : []),
    [metrics],
  );

  const cycleSpark = useMemo(
    () => (metrics ? buildSparkline(metrics.cycle_time.primary) : null),
    [metrics],
  );
  const errorSpark = useMemo(
    () => (metrics ? buildSparkline(metrics.error_rate.primary) : null),
    [metrics],
  );
  const wipSpark = useMemo(
    () =>
      metrics ? buildWipSparkline(metrics.wip.primary, "in_progress") : null,
    [metrics],
  );

  const activeProgress = useMemo(
    () => (metrics ? Math.min(100, metrics.kpis.active_agents * 12.5) : 0),
    [metrics],
  );
  const wipProgress = useMemo(() => calcProgress(wipSpark?.values), [wipSpark]);
  const errorProgress = useMemo(
    () => calcProgress(errorSpark?.values),
    [errorSpark],
  );
  const cycleProgress = useMemo(
    () => calcProgress(cycleSpark?.values),
    [cycleSpark],
  );

  return (
    <DashboardShell>
      <SignedOut>
        <SignedOutPanel
          message="Sign in to access the dashboard."
          forceRedirectUrl="/onboarding"
          signUpForceRedirectUrl="/onboarding"
        />
      </SignedOut>
      <SignedIn>
        <DashboardSidebar />
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <div className="border-b border-slate-200 bg-white px-8 py-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-heading text-2xl font-semibold text-slate-900 tracking-tight">
                  Dashboard
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Monitor your mission control operations
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <DropdownSelect
                  value={selectedRange}
                  onValueChange={(value) => {
                    const nextRange = value as RangeKey;
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("range", nextRange);
                    router.replace(`${pathname}?${params.toString()}`);
                  }}
                  options={DASHBOARD_RANGE_OPTIONS}
                  ariaLabel="Dashboard date range"
                  placeholder="Select range"
                  searchEnabled={false}
                  triggerClassName="h-9 min-w-[150px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  contentClassName="rounded-lg border border-slate-200"
                />
              </div>
            </div>
          </div>
          <div className="p-8">
            {metricsQuery.error ? (
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
                {metricsQuery.error.message}
              </div>
            ) : null}

            {metricsQuery.isLoading && !metrics ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
                Loading dashboard metrics…
              </div>
            ) : null}

            {metrics ? (
              <>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                  <KpiCard
                    label="Active agents"
                    value={formatNumber(metrics.kpis.active_agents)}
                    icon={<Users className="h-4 w-4" />}
                    progress={activeProgress}
                  />
                  <KpiCard
                    label="Tasks in progress"
                    value={formatNumber(metrics.kpis.tasks_in_progress)}
                    icon={<PenSquare className="h-4 w-4" />}
                    progress={wipProgress}
                  />
                  <KpiCard
                    label="Error rate"
                    value={formatPercent(metrics.kpis.error_rate_pct)}
                    icon={<Activity className="h-4 w-4" />}
                    progress={errorProgress}
                  />
                  <KpiCard
                    label="Median cycle time"
                    value={formatHours(metrics.kpis.median_cycle_time_hours_7d)}
                    icon={<Timer className="h-4 w-4" />}
                    progress={cycleProgress}
                  />
                </div>

                <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <ChartCard title="Completed Tasks" subtitle="Throughput">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={throughputSeries}
                        margin={{ left: 4, right: 12 }}
                      >
                        <CartesianGrid vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="period"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#94a3b8", fontSize: 11 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#94a3b8", fontSize: 11 }}
                          width={40}
                        />
                        <Tooltip
                          content={
                            <TooltipCard formatter={(v) => formatNumber(v)} />
                          }
                        />
                        <Legend
                          verticalAlign="bottom"
                          align="center"
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{
                            paddingTop: "8px",
                            fontSize: "12px",
                            color: "#64748b",
                          }}
                        />
                        <Bar
                          dataKey="value"
                          name="Completed"
                          fill="#2563eb"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Avg Hours to Review" subtitle="Cycle time">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={cycleSeries}
                        margin={{ left: 4, right: 12 }}
                      >
                        <CartesianGrid vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="period"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#94a3b8", fontSize: 11 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#94a3b8", fontSize: 11 }}
                          width={40}
                        />
                        <Tooltip
                          content={
                            <TooltipCard
                              formatter={(v) => `${v.toFixed(1)}h`}
                            />
                          }
                        />
                        <Legend
                          verticalAlign="bottom"
                          align="center"
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{
                            paddingTop: "8px",
                            fontSize: "12px",
                            color: "#64748b",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          name="Hours"
                          stroke="#1d4ed8"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Failed Events" subtitle="Error rate">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={errorSeries}
                        margin={{ left: 4, right: 12 }}
                      >
                        <CartesianGrid vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="period"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#94a3b8", fontSize: 11 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#94a3b8", fontSize: 11 }}
                          width={40}
                        />
                        <Tooltip
                          content={
                            <TooltipCard formatter={(v) => formatPercent(v)} />
                          }
                        />
                        <Legend
                          verticalAlign="bottom"
                          align="center"
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{
                            paddingTop: "8px",
                            fontSize: "12px",
                            color: "#64748b",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          name="Error rate"
                          stroke="#1e40af"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard
                    title="Status Distribution"
                    subtitle="Work in progress"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={wipSeries}
                        margin={{ left: 4, right: 12 }}
                      >
                        <CartesianGrid vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="period"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#94a3b8", fontSize: 11 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#94a3b8", fontSize: 11 }}
                          width={40}
                        />
                        <Tooltip
                          content={
                            <TooltipCard formatter={(v) => formatNumber(v)} />
                          }
                        />
                        <Legend
                          verticalAlign="bottom"
                          align="center"
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{
                            paddingTop: "8px",
                            fontSize: "12px",
                            color: "#64748b",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="inbox"
                          name="Inbox"
                          stackId="wip"
                          fill="#fed7aa"
                          stroke="#ea580c"
                          fillOpacity={0.8}
                        />
                        <Area
                          type="monotone"
                          dataKey="in_progress"
                          name="In progress"
                          stackId="wip"
                          fill="#bfdbfe"
                          stroke="#1d4ed8"
                          fillOpacity={0.8}
                        />
                        <Area
                          type="monotone"
                          dataKey="review"
                          name="Review"
                          stackId="wip"
                          fill="#e9d5ff"
                          stroke="#7e22ce"
                          fillOpacity={0.85}
                        />
                        <Area
                          type="monotone"
                          dataKey="done"
                          name="Done"
                          stackId="wip"
                          fill="#bbf7d0"
                          stroke="#15803d"
                          fillOpacity={0.9}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
              </>
            ) : null}
          </div>
        </main>
      </SignedIn>
    </DashboardShell>
  );
}
