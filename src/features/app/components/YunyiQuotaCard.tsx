import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

const API_URL = "https://yunyi.cfd/user/api/v1/me";
const REFRESH_MS = 5 * 60 * 1000;

type YunyiQuotaData = {
  dailyLeftCents: number;
  dailyPercent: number;
  billingType: string | null;
  nextResetAt: Date | null;
};

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

const normalizeToken = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.toLowerCase().startsWith("bearer ")
    ? trimmed
    : `Bearer ${trimmed}`;
};

const formatCurrency = (cents: number) => {
  if (!Number.isFinite(cents)) {
    return "--";
  }
  return `$${(cents / 100).toFixed(2)}`;
};

const formatTime = (timestamp: number) => {
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return formatter.format(new Date(timestamp));
};

const computeResetText = (
  nextResetAt: Date | null,
  now: number,
  t: ReturnType<typeof useI18n>["t"],
) => {
  if (!nextResetAt) {
    return "";
  }
  const diff = nextResetAt.getTime() - now;
  if (diff <= 0) {
    return t("sidebar.yunyi.reset.soon");
  }
  const totalMinutes = Math.ceil(diff / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) {
    return t("sidebar.yunyi.reset.minutes", { minutes });
  }
  return t("sidebar.yunyi.reset.hoursMinutes", { hours, minutes });
};

const getBillingLabel = (
  billingType: string | null,
  t: ReturnType<typeof useI18n>["t"],
) => {
  if (billingType === "duration") {
    return t("sidebar.yunyi.billing.duration");
  }
  if (billingType === "amount" || billingType === "money") {
    return t("sidebar.yunyi.billing.amount");
  }
  return t("sidebar.yunyi.billing.quota");
};

const parseQuota = (payload: unknown): YunyiQuotaData | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const data = payload as {
    quota?: {
      daily_quota?: number;
      daily_spent?: number;
      daily_used?: number;
      next_reset_at?: string;
      type?: string;
    };
    billing_type?: string;
  };
  if (!data.quota) {
    return null;
  }
  const dailyPercent = Number(data.quota.daily_used ?? 0);
  const dailyLeftCents =
    Number(data.quota.daily_quota ?? 0) - Number(data.quota.daily_spent ?? 0);
  const nextResetAt = data.quota.next_reset_at
    ? new Date(data.quota.next_reset_at)
    : null;
  return {
    dailyLeftCents,
    dailyPercent,
    billingType: data.billing_type ?? data.quota.type ?? null,
    nextResetAt:
      nextResetAt && !Number.isNaN(nextResetAt.getTime()) ? nextResetAt : null,
  };
};

export function YunyiQuotaCard({
  token,
  className,
}: {
  token: string;
  className?: string;
}) {
  const { t } = useI18n();
  const [data, setData] = useState<YunyiQuotaData | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const normalizedToken = useMemo(() => normalizeToken(token), [token]);

  useEffect(() => {
    if (!data?.nextResetAt) {
      return;
    }
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 60000);
    return () => window.clearInterval(timer);
  }, [data?.nextResetAt]);

  useEffect(() => {
    if (!normalizedToken) {
      setStatus("idle");
      setData(null);
      setUpdatedAt(null);
      return;
    }
    let cancelled = false;

    const load = async () => {
      setStatus((prev) => (prev === "ready" ? "ready" : "loading"));
      try {
        const response = await fetch(API_URL, {
          headers: { Authorization: normalizedToken },
        });
        if (!response.ok) {
          throw new Error("quota");
        }
        const payload = await response.json();
        const raw = payload?.data ?? payload;
        const parsed = parseQuota(raw);
        if (!parsed) {
          throw new Error("quota");
        }
        if (cancelled) {
          return;
        }
        setData(parsed);
        setUpdatedAt(Date.now());
        setStatus("ready");
      } catch {
        if (cancelled) {
          return;
        }
        setStatus("error");
      }
    };

    void load();
    const interval = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [normalizedToken]);

  if (!normalizedToken) {
    return (
      <div
        className={cn(
          "rounded-md border border-border/60 bg-sidebar/30 px-3 py-2 text-xs text-muted-foreground",
          className,
        )}
      >
        {t("sidebar.yunyi.missingToken")}
      </div>
    );
  }

  if (status === "loading" && !data) {
    return (
      <div
        className={cn(
          "space-y-3 rounded-md border border-border/60 bg-sidebar/30 p-3",
          className,
        )}
      >
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <Skeleton className="h-3 w-24" />
      </div>
    );
  }

  const percent = clampPercent(data?.dailyPercent ?? 0);
  const percentLabel = `${Math.round(percent)}%`;
  const dailyValue = data ? formatCurrency(data.dailyLeftCents) : "--";
  const resetText = computeResetText(data?.nextResetAt ?? null, now, t);
  const billingLabel = getBillingLabel(data?.billingType ?? null, t);
  const updatedLabel = updatedAt
    ? t("sidebar.yunyi.updatedAt", { time: formatTime(updatedAt) })
    : "--";
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (percent / 100) * circumference;

  return (
    <div
      className={cn(
        "space-y-2 rounded-md border border-border/60 bg-sidebar/30 p-3 text-sidebar-foreground",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className="relative flex h-10 w-10 items-center justify-center">
          <svg
            className="absolute inset-0"
            width={40}
            height={40}
            viewBox="0 0 40 40"
            role="img"
            aria-label={percentLabel}
          >
            <circle
              cx="20"
              cy="20"
              r={radius}
              fill="transparent"
              stroke="var(--sidebar-accent)"
              strokeWidth="4"
            />
            <circle
              cx="20"
              cy="20"
              r={radius}
              fill="transparent"
              stroke="var(--sidebar-primary)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
            />
          </svg>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sidebar text-[10px] font-semibold text-sidebar-foreground">
            {percentLabel}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">
            {t("sidebar.yunyi.dailyQuota")}
          </div>
          <div className="text-base font-semibold tabular-nums">{dailyValue}</div>
          <div className="text-xs text-muted-foreground">
            {billingLabel}
            {resetText ? ` · ${resetText}` : ""}
          </div>
        </div>
      </div>
      <div className="text-[11px] text-muted-foreground">{updatedLabel}</div>
      {status === "error" && (
        <div className="text-xs text-destructive">
          {t("sidebar.yunyi.error")}
        </div>
      )}
    </div>
  );
}
