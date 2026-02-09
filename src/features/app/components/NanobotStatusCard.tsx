import CircleDot from "lucide-react/dist/esm/icons/circle-dot";

type NanobotStatusCardProps = {
  enabled: boolean;
  running: boolean;
  connected: boolean;
  reason: string | null;
  lastEventLabel: string;
  statusLabel: string;
  modeLabel: string;
  channelLabel: string;
  runtimeLabel: string;
  reasonLabel: string;
  onOpenLog: () => void;
};

export function NanobotStatusCard({
  enabled,
  running,
  connected,
  reason,
  lastEventLabel,
  statusLabel,
  modeLabel,
  channelLabel,
  runtimeLabel,
  reasonLabel,
  onOpenLog,
}: NanobotStatusCardProps) {
  const dotClassName = !enabled
    ? "text-muted-foreground"
    : connected
      ? "text-emerald-500"
      : running
        ? "text-amber-500"
        : "text-rose-500";

  return (
    <button
      type="button"
      onClick={onOpenLog}
      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-left text-xs transition-colors hover:bg-accent/40"
      title={statusLabel}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground">Nanobot</span>
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <CircleDot className={`h-3.5 w-3.5 ${dotClassName}`} aria-hidden />
          {statusLabel}
        </span>
      </div>
      <div className="mt-2 space-y-1 text-muted-foreground">
        <div>{modeLabel}</div>
        <div>{channelLabel}</div>
        <div>{runtimeLabel}</div>
        <div>{lastEventLabel}</div>
        {reason ? (
          <div className="truncate text-[11px] text-rose-500" title={`${reasonLabel}: ${reason}`}>
            {reasonLabel}: {reason}
          </div>
        ) : null}
      </div>
    </button>
  );
}
