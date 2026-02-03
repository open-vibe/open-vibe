type SidebarFooterProps = {
  sessionPercent: number | null;
  weeklyPercent: number | null;
  sessionResetLabel: string | null;
  weeklyResetLabel: string | null;
  creditsLabel: string | null;
  showWeekly: boolean;
};

export function SidebarFooter({
  sessionPercent,
  weeklyPercent,
  sessionResetLabel,
  weeklyResetLabel,
  creditsLabel,
  showWeekly,
}: SidebarFooterProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
      <div className="space-y-3 text-foreground">
        <div className="space-y-2">
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
          <div className="space-y-2">
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
        <div className="mt-3 text-[10px] text-muted-foreground">{creditsLabel}</div>
      )}
    </div>
  );
}
