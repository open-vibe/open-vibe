import CircleDot from "lucide-react/dist/esm/icons/circle-dot";
import Bluetooth from "lucide-react/dist/esm/icons/bluetooth";
import Smartphone from "lucide-react/dist/esm/icons/smartphone";
import Bot from "lucide-react/dist/esm/icons/bot";
import Link2 from "lucide-react/dist/esm/icons/link-2";
import Gauge from "lucide-react/dist/esm/icons/gauge";
import Clock3 from "lucide-react/dist/esm/icons/clock-3";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type NanobotStatusCardProps = {
  enabled: boolean;
  running: boolean;
  connected: boolean;
  reason: string | null;
  lastEventValue: string;
  statusLabel: string;
  modeValue: string;
  channelValue: string;
  runtimeValue: string;
  modeTooltip: string;
  channelTooltip: string;
  runtimeTooltip: string;
  lastEventTooltip: string;
  statusTooltip: string;
  reasonLabel: string;
  bluetoothLabel: string;
  nearbyLabel: string;
  bluetoothEnabled: boolean;
  bluetoothSupported: boolean;
  bluetoothScanning: boolean;
  bluetoothNearby: boolean | null;
  onOpenLog: () => void;
  compact?: boolean;
};

export function NanobotStatusCard({
  enabled,
  running,
  connected,
  reason,
  lastEventValue,
  statusLabel,
  modeValue,
  channelValue,
  runtimeValue,
  modeTooltip,
  channelTooltip,
  runtimeTooltip,
  lastEventTooltip,
  statusTooltip,
  reasonLabel,
  bluetoothLabel,
  nearbyLabel,
  bluetoothEnabled,
  bluetoothSupported,
  bluetoothScanning,
  bluetoothNearby,
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
  const bluetoothClassName = !bluetoothEnabled
    ? "text-muted-foreground"
    : bluetoothScanning
      ? "text-amber-500 animate-pulse"
      : bluetoothSupported
        ? "text-emerald-500"
        : "text-rose-500";
  const nearbyClassName = !bluetoothEnabled
    ? "text-muted-foreground"
    : bluetoothNearby === true
      ? "text-emerald-500"
      : bluetoothNearby === false
        ? "text-rose-500"
        : "text-amber-500";

  return (
    <button
      type="button"
      onClick={onOpenLog}
      className={cn(
        "relative w-full rounded-lg border border-border bg-card text-left text-xs transition-colors hover:bg-accent/40",
        compact ? "px-2 py-1.5" : "px-3 py-2",
      )}
      title={statusLabel}
    >
      <span className="absolute right-1 top-1 inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center cursor-help">
              <Bluetooth className={`h-3.5 w-3.5 ${bluetoothClassName}`} aria-hidden />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">{bluetoothLabel}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center cursor-help">
              <Smartphone className={`h-3.5 w-3.5 ${nearbyClassName}`} aria-hidden />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">{nearbyLabel}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 cursor-help">
              <CircleDot className={`h-3.5 w-3.5 ${dotClassName}`} aria-hidden />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">{statusTooltip}</TooltipContent>
        </Tooltip>
      </span>
      <div
        className={cn(
          "pr-14 text-muted-foreground",
          compact ? "space-y-0.5" : "space-y-1",
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 cursor-help">
              <Bot className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" aria-hidden />
              <span className="min-w-0 truncate">{modeValue}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">{modeTooltip}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 cursor-help">
              <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" aria-hidden />
              <span className="min-w-0 truncate">{channelValue}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">{channelTooltip}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 cursor-help">
              <Gauge className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" aria-hidden />
              <span className="min-w-0 truncate">{runtimeValue}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">{runtimeTooltip}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 cursor-help">
              <Clock3 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" aria-hidden />
              <span className="min-w-0 truncate">{lastEventValue}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">{lastEventTooltip}</TooltipContent>
        </Tooltip>
        {reason ? (
          <div className="truncate text-[11px] text-rose-500" title={`${reasonLabel}: ${reason}`}>
            {reasonLabel}: {reason}
          </div>
        ) : null}
      </div>
    </button>
  );
}
