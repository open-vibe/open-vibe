import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import FolderOpen from "lucide-react/dist/esm/icons/folder-open";
import Plus from "lucide-react/dist/esm/icons/plus";
import { Bar, BarChart, Tooltip, XAxis } from "recharts";
import type { LocalUsageSnapshot } from "../../../types";
import { formatRelativeTime } from "../../../utils/time";
import { useI18n } from "../../../i18n";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";

type LatestAgentRun = {
  message: string;
  timestamp: number;
  projectName: string;
  groupName?: string | null;
  workspaceId: string;
  threadId: string;
  isProcessing: boolean;
};

type UsageMetric = "tokens" | "time";

type UsageWorkspaceOption = {
  id: string;
  label: string;
};

type HomeProps = {
  onOpenProject: () => void;
  onAddWorkspace: () => void;
  latestAgentRuns: LatestAgentRun[];
  isLoadingLatestAgents: boolean;
  localUsageSnapshot: LocalUsageSnapshot | null;
  isLoadingLocalUsage: boolean;
  localUsageError: string | null;
  onRefreshLocalUsage: () => void;
  usageMetric: UsageMetric;
  onUsageMetricChange: (metric: UsageMetric) => void;
  usageWorkspaceId: string | null;
  usageWorkspaceOptions: UsageWorkspaceOption[];
  onUsageWorkspaceChange: (workspaceId: string | null) => void;
  onSelectThread: (workspaceId: string, threadId: string) => void;
};

export function Home({
  onOpenProject,
  onAddWorkspace,
  latestAgentRuns,
  isLoadingLatestAgents,
  localUsageSnapshot,
  isLoadingLocalUsage,
  localUsageError,
  onRefreshLocalUsage,
  usageMetric,
  onUsageMetricChange,
  usageWorkspaceId,
  usageWorkspaceOptions,
  onUsageWorkspaceChange,
  onSelectThread,
}: HomeProps) {
  const { t } = useI18n();
  const formatCompactNumber = (value: number | null | undefined) => {
    if (value === null || value === undefined) {
      return "--";
    }
    if (value >= 1_000_000_000) {
      const scaled = value / 1_000_000_000;
      return `${scaled.toFixed(scaled >= 10 ? 0 : 1)}b`;
    }
    if (value >= 1_000_000) {
      const scaled = value / 1_000_000;
      return `${scaled.toFixed(scaled >= 10 ? 0 : 1)}m`;
    }
    if (value >= 1_000) {
      const scaled = value / 1_000;
      return `${scaled.toFixed(scaled >= 10 ? 0 : 1)}k`;
    }
    return String(value);
  };

  const formatCount = (value: number | null | undefined) => {
    if (value === null || value === undefined) {
      return "--";
    }
    return new Intl.NumberFormat().format(value);
  };

  const formatDuration = (valueMs: number | null | undefined) => {
    if (valueMs === null || valueMs === undefined) {
      return "--";
    }
    const totalSeconds = Math.max(0, Math.round(valueMs / 1000));
    const totalMinutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (totalMinutes > 0) {
      return `${totalMinutes}m`;
    }
    return `${totalSeconds}s`;
  };

  const formatDurationCompact = (valueMs: number | null | undefined) => {
    if (valueMs === null || valueMs === undefined) {
      return "--";
    }
    const totalMinutes = Math.max(0, Math.round(valueMs / 60000));
    if (totalMinutes >= 60) {
      const hours = totalMinutes / 60;
      return `${hours.toFixed(hours >= 10 ? 0 : 1)}h`;
    }
    if (totalMinutes > 0) {
      return `${totalMinutes}m`;
    }
    const seconds = Math.max(0, Math.round(valueMs / 1000));
    return `${seconds}s`;
  };

  const formatDayLabel = (value: string | null | undefined) => {
    if (!value) {
      return "--";
    }
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) {
      return value;
    }
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(date);
  };

  const usageTotals = localUsageSnapshot?.totals ?? null;
  const usageDays = localUsageSnapshot?.days ?? [];
  const last7Days = usageDays.slice(-7);
  const last7AgentMs = last7Days.reduce(
    (total, day) => total + (day.agentTimeMs ?? 0),
    0,
  );
  const last30AgentMs = usageDays.reduce(
    (total, day) => total + (day.agentTimeMs ?? 0),
    0,
  );
  const averageDailyAgentMs =
    last7Days.length > 0 ? Math.round(last7AgentMs / last7Days.length) : 0;
  const last7AgentRuns = last7Days.reduce(
    (total, day) => total + (day.agentRuns ?? 0),
    0,
  );
  const peakAgentDay = usageDays.reduce<
    | { day: string; agentTimeMs: number }
    | null
  >((best, day) => {
    const value = day.agentTimeMs ?? 0;
    if (value <= 0) {
      return best;
    }
    if (!best || value > best.agentTimeMs) {
      return { day: day.day, agentTimeMs: value };
    }
    return best;
  }, null);
  const peakAgentDayLabel = peakAgentDay?.day ?? null;
  const peakAgentTimeMs = peakAgentDay?.agentTimeMs ?? 0;
  const updatedLabel = localUsageSnapshot
    ? t("home.usage.updated", {
        time: formatRelativeTime(localUsageSnapshot.updatedAt),
      })
    : null;
  const showUsageSkeleton = isLoadingLocalUsage && !localUsageSnapshot;
  const showUsageEmpty = !isLoadingLocalUsage && !localUsageSnapshot;
  const usageWorkspaceValue = usageWorkspaceId ?? "all";
  const chartConfig = {
    tokens: {
      label: t("home.usage.view.tokens"),
      color: "var(--sidebar-primary)",
    },
    time: {
      label: t("home.usage.view.time"),
      color: "var(--sidebar-primary)",
    },
  } satisfies ChartConfig;
  const chartMetricKey = usageMetric === "tokens" ? "tokens" : "time";
  const chartData = last7Days.map((day) => ({
    day: formatDayLabel(day.day),
    tokens: day.totalTokens ?? 0,
    time: day.agentTimeMs ?? 0,
  }));

  return (
    <div
      className="home-scroll mx-auto flex h-full w-full max-w-5xl flex-col gap-6 overflow-y-auto overflow-x-hidden px-6 py-8"
      style={{ gridColumn: "1 / -1", gridRow: "3 / 4" }}
    >
      <Card className="shadow-none">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">{t("home.title")}</CardTitle>
          <CardDescription>{t("home.subtitle")}</CardDescription>
        </CardHeader>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">{t("home.latest.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {latestAgentRuns.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-3">
              {latestAgentRuns.map((run) => (
                <button
                  key={run.threadId}
                  type="button"
                  onClick={() => onSelectThread(run.workspaceId, run.threadId)}
                  className="group rounded-lg border border-border/60 bg-card p-4 text-left transition hover:border-border hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">
                          {run.projectName}
                        </span>
                        {run.groupName && (
                          <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {run.groupName}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatRelativeTime(run.timestamp)}
                      </div>
                    </div>
                    {run.isProcessing && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        {t("home.latest.status.running")}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 line-clamp-2 text-sm text-foreground">
                    {run.message.trim() || t("home.latest.fallback")}
                  </div>
                </button>
              ))}
            </div>
          ) : isLoadingLatestAgents ? (
            <div
              className="grid gap-3 md:grid-cols-3"
              aria-label={t("home.latest.loading")}
            >
              {Array.from({ length: 3 }).map((_, index) => (
                <Card key={index} className="shadow-none">
                  <CardContent className="space-y-3 p-4">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-4/5" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border/60 p-4">
              <div className="text-sm font-medium">
                {t("home.latest.empty.title")}
              </div>
              <div className="text-sm text-muted-foreground">
                {t("home.latest.empty.subtitle")}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Button
          className="h-12 justify-start gap-2"
          variant="default"
          onClick={onOpenProject}
          data-tauri-drag-region="false"
        >
          <FolderOpen className="size-4" />
          {t("home.actions.openProject")}
        </Button>
        <Button
          className="h-12 justify-start gap-2"
          variant="outline"
          onClick={onAddWorkspace}
          data-tauri-drag-region="false"
        >
          <Plus className="size-4" />
          {t("home.actions.addWorkspace")}
        </Button>
      </div>

      <Card className="shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">{t("home.usage.title")}</CardTitle>
            {updatedLabel && (
              <CardDescription>{updatedLabel}</CardDescription>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRefreshLocalUsage}
            disabled={isLoadingLocalUsage}
            aria-label={t("home.usage.refresh")}
            title={t("home.usage.refresh")}
          >
            <RefreshCw
              className={isLoadingLocalUsage ? "size-4 animate-spin" : "size-4"}
            />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("home.usage.workspace.label")}
              </span>
              <Select
                value={usageWorkspaceValue}
                onValueChange={(value) =>
                  onUsageWorkspaceChange(value === "all" ? null : value)
                }
                disabled={usageWorkspaceOptions.length === 0}
              >
                <SelectTrigger className="h-8 w-[220px]">
                  <SelectValue placeholder={t("home.usage.workspace.all")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("home.usage.workspace.all")}
                  </SelectItem>
                  {usageWorkspaceOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("home.usage.view.label")}
              </span>
              <Tabs
                value={usageMetric}
                onValueChange={(value) =>
                  onUsageMetricChange(value as UsageMetric)
                }
              >
                <TabsList className="h-8">
                  <TabsTrigger value="tokens" className="text-xs">
                    {t("home.usage.view.tokens")}
                  </TabsTrigger>
                  <TabsTrigger value="time" className="text-xs">
                    {t("home.usage.view.time")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {showUsageSkeleton ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Card key={index} className="shadow-none">
                    <CardContent className="space-y-2 p-4">
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-6 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card className="shadow-none">
                <CardContent className="p-4">
                  <Skeleton className="h-[160px] w-full" />
                </CardContent>
              </Card>
            </div>
          ) : showUsageEmpty ? (
            <div className="rounded-lg border border-dashed border-border/60 p-4">
              <div className="text-sm font-medium">
                {t("home.usage.empty.title")}
              </div>
              <div className="text-sm text-muted-foreground">
                {t("home.usage.empty.subtitle")}
              </div>
              {localUsageError && (
                <div className="mt-2 text-sm text-destructive">
                  {localUsageError}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                {usageMetric === "tokens" ? (
                  <>
                    <Card className="shadow-none">
                      <CardContent className="space-y-2 p-4">
                        <div className="text-xs uppercase text-muted-foreground">
                          {t("home.usage.metrics.last7Days")}
                        </div>
                        <div className="text-2xl font-semibold">
                          {formatCompactNumber(usageTotals?.last7DaysTokens)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t("home.usage.metrics.avgPerDay", {
                            value: formatCompactNumber(
                              usageTotals?.averageDailyTokens,
                            ),
                          })}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="shadow-none">
                      <CardContent className="space-y-2 p-4">
                        <div className="text-xs uppercase text-muted-foreground">
                          {t("home.usage.metrics.last30Days")}
                        </div>
                        <div className="text-2xl font-semibold">
                          {formatCompactNumber(usageTotals?.last30DaysTokens)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t("home.usage.metrics.total", {
                            value: formatCount(usageTotals?.last30DaysTokens),
                          })}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="shadow-none">
                      <CardContent className="space-y-2 p-4">
                        <div className="text-xs uppercase text-muted-foreground">
                          {t("home.usage.metrics.cacheHitRate")}
                        </div>
                        <div className="text-2xl font-semibold">
                          {usageTotals
                            ? `${usageTotals.cacheHitRatePercent.toFixed(1)}%`
                            : "--"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t("home.usage.metrics.last7Days")}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="shadow-none">
                      <CardContent className="space-y-2 p-4">
                        <div className="text-xs uppercase text-muted-foreground">
                          {t("home.usage.metrics.peakDay")}
                        </div>
                        <div className="text-2xl font-semibold">
                          {formatDayLabel(usageTotals?.peakDay)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t("home.usage.metrics.tokensWithValue", {
                            value: formatCompactNumber(usageTotals?.peakDayTokens),
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <>
                    <Card className="shadow-none">
                      <CardContent className="space-y-2 p-4">
                        <div className="text-xs uppercase text-muted-foreground">
                          {t("home.usage.metrics.last7Days")}
                        </div>
                        <div className="text-2xl font-semibold">
                          {formatDurationCompact(last7AgentMs)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t("home.usage.metrics.avgPerDay", {
                            value: formatDurationCompact(averageDailyAgentMs),
                          })}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="shadow-none">
                      <CardContent className="space-y-2 p-4">
                        <div className="text-xs uppercase text-muted-foreground">
                          {t("home.usage.metrics.last30Days")}
                        </div>
                        <div className="text-2xl font-semibold">
                          {formatDurationCompact(last30AgentMs)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t("home.usage.metrics.total", {
                            value: formatDuration(last30AgentMs),
                          })}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="shadow-none">
                      <CardContent className="space-y-2 p-4">
                        <div className="text-xs uppercase text-muted-foreground">
                          {t("home.usage.metrics.runs")}
                        </div>
                        <div className="text-2xl font-semibold">
                          {formatCount(last7AgentRuns)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t("home.usage.metrics.last7Days")}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="shadow-none">
                      <CardContent className="space-y-2 p-4">
                        <div className="text-xs uppercase text-muted-foreground">
                          {t("home.usage.metrics.peakDay")}
                        </div>
                        <div className="text-2xl font-semibold">
                          {formatDayLabel(peakAgentDayLabel)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t("home.usage.metrics.agentTimeWithValue", {
                            value: formatDurationCompact(peakAgentTimeMs),
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>

              <Card className="shadow-none">
                <CardContent className="p-4">
                  <ChartContainer config={chartConfig} className="h-[160px]">
                    <BarChart data={chartData} margin={{ left: 0, right: 0 }}>
                      <XAxis
                        dataKey="day"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                      />
                      <Tooltip
                        cursor={{
                          fill: "color-mix(in oklab, var(--sidebar-primary) 18%, transparent)",
                        }}
                        content={({ active, payload, label }) => {
                          if (!active || !payload || !payload.length) {
                            return null;
                          }
                          const rawValue = payload[0]?.value as number;
                          const valueLabel =
                            usageMetric === "tokens"
                              ? formatCount(rawValue)
                              : formatDuration(rawValue);
                          const descriptor =
                            usageMetric === "tokens"
                              ? t("home.usage.view.tokens")
                              : t("home.usage.view.time");
                          return (
                            <div className="rounded-md border border-border/60 bg-popover px-3 py-2 text-xs text-foreground shadow-sm">
                              <div className="font-semibold">{label}</div>
                              <div className="text-muted-foreground">
                                {descriptor}: {valueLabel}
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Bar
                        dataKey={chartMetricKey}
                        radius={[4, 4, 0, 0]}
                        fill={`var(--color-${chartMetricKey})`}
                      />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("home.usage.models.title")}
                  {usageMetric === "time" && (
                    <span className="ml-2 text-[10px] font-normal normal-case text-muted-foreground">
                      {t("home.usage.models.tokensHint")}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {localUsageSnapshot?.topModels?.length ? (
                    localUsageSnapshot.topModels.map((model) => (
                      <span
                        className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs"
                        key={model.model}
                        title={`${model.model}: ${formatCount(model.tokens)} tokens`}
                      >
                        {model.model}
                        <span className="text-[10px] text-muted-foreground">
                          {model.sharePercent.toFixed(1)}%
                        </span>
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {t("home.usage.models.empty")}
                    </span>
                  )}
                </div>
                {localUsageError && (
                  <div className="text-sm text-destructive">
                    {localUsageError}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
