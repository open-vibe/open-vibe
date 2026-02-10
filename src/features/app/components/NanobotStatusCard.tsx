import CircleDot from "lucide-react/dist/esm/icons/circle-dot";
import { cn } from "@/lib/utils";

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
  compact?: boolean;
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
  compact = false,
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
      className={cn(
        "w-full rounded-lg border border-border bg-card text-left text-xs transition-colors hover:bg-accent/40",
        compact ? "px-2 py-1.5" : "px-3 py-2",
      )}
      title={statusLabel}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground">Nanobot</span>
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <CircleDot className={`h-3.5 w-3.5 ${dotClassName}`} aria-hidden />
          {statusLabel}
        </span>
      </div>
      <div className={cn("text-muted-foreground", compact ? "mt-1.5 space-y-0.5" : "mt-2 space-y-1")}>
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
