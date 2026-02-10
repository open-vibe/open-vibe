import { cn } from "@/lib/utils";

type SidebarFooterProps = {
  sessionPercent: number | null;
  weeklyPercent: number | null;
  sessionResetLabel: string | null;
  weeklyResetLabel: string | null;
  creditsLabel: string | null;
  showWeekly: boolean;
  compact?: boolean;
};

export function SidebarFooter({
  sessionPercent,
  weeklyPercent,
  sessionResetLabel,
  weeklyResetLabel,
  creditsLabel,
  showWeekly,
  compact = false,
}: SidebarFooterProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card text-xs text-muted-foreground",
        compact ? "p-2" : "p-3",
      )}
    >
      <div className={cn("text-foreground", compact ? "space-y-2" : "space-y-3")}>
        <div className={cn(compact ? "space-y-1.5" : "space-y-2")}>
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span className="inline-flex items-center gap-2">
              <span>Session</span>
              {sessionResetLabel && (
                <span className="text-[10px] font-medium text-muted-foreground">
                  · {sessionResetLabel}
                </span>
              )}
            </span>
            <span className="text-muted-foreground">
              {sessionPercent === null ? "" : `${sessionPercent}%`}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-emerald-300 to-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.35)]"
              style={{ width: `${sessionPercent ?? 0}%` }}
            />
          </div>
        </div>
        {showWeekly && (
          <div className={cn(compact ? "space-y-1.5" : "space-y-2")}>
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="inline-flex items-center gap-2">
                <span>Weekly</span>
                {weeklyResetLabel && (
                  <span className="text-[10px] font-medium text-muted-foreground">
                    · {weeklyResetLabel}
                  </span>
                )}
              </span>
              <span className="text-muted-foreground">
                {weeklyPercent === null ? "" : `${weeklyPercent}%`}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-emerald-300 to-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.35)]"
                style={{ width: `${weeklyPercent ?? 0}%` }}
              />
            </div>
          </div>
        )}
      </div>
      {creditsLabel && (
        <div className={cn("text-[10px] text-muted-foreground", compact ? "mt-2" : "mt-3")}>
          {creditsLabel}
        </div>
      )}
    </div>
  );
}
