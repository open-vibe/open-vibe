import { Brain, ChevronDown, ShieldCheck, Sparkles, Users } from "lucide-react";
import {
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import type { AccessMode, ThreadTokenUsage } from "../../../types";
import { formatCollaborationModeLabel } from "../../../utils/collaborationModes";
import { useI18n } from "../../../i18n";

type ComposerMetaBarProps = {
  disabled: boolean;
  collaborationModes: { id: string; label: string }[];
  selectedCollaborationModeId: string | null;
  onSelectCollaborationMode: (id: string | null) => void;
  models: { id: string; displayName: string; model: string }[];
  selectedModelId: string | null;
  onSelectModel: (id: string) => void;
  reasoningOptions: string[];
  selectedEffort: string | null;
  onSelectEffort: (effort: string) => void;
  reasoningSupported: boolean;
  accessMode: AccessMode;
  onSelectAccessMode: (mode: AccessMode) => void;
  contextUsage?: ThreadTokenUsage | null;
};

export function ComposerMetaBar({
  disabled,
  collaborationModes,
  selectedCollaborationModeId,
  onSelectCollaborationMode,
  models,
  selectedModelId,
  onSelectModel,
  reasoningOptions,
  selectedEffort,
  onSelectEffort,
  reasoningSupported,
  accessMode,
  onSelectAccessMode,
  contextUsage = null,
}: ComposerMetaBarProps) {
  const { t } = useI18n();
  const collabLabel = collaborationModes.find(
    (mode) => mode.id === selectedCollaborationModeId,
  )?.label;
  const selectedModel = models.find((model) => model.id === selectedModelId);
  const modelLabel = selectedModel?.displayName || selectedModel?.model;
  const effortLabel =
    reasoningOptions.find((effort) => effort === selectedEffort) ??
    (reasoningOptions.length === 0 ? t("composer.default") : selectedEffort);
  const accessLabel =
    accessMode === "read-only"
      ? t("composer.access.readOnly")
      : accessMode === "full-access"
        ? t("composer.access.full")
        : t("composer.access.onRequest");
  const contextWindow = contextUsage?.modelContextWindow ?? null;
  const lastTokens = contextUsage?.last.totalTokens ?? 0;
  const totalTokens = contextUsage?.total.totalTokens ?? 0;
  const usedTokens = lastTokens > 0 ? lastTokens : totalTokens;
  const contextFreePercent =
    contextWindow && contextWindow > 0 && usedTokens > 0
      ? Math.max(
          0,
          100 - Math.min(Math.max((usedTokens / contextWindow) * 100, 0), 100),
        )
      : null;
  const contextUsedPercent =
    contextFreePercent === null
      ? null
      : Math.min(Math.max(100 - contextFreePercent, 0), 100);
  const contextLabel =
    contextFreePercent === null
      ? t("composer.contextFreeUnknown")
      : t("composer.contextFree", {
          percent: Math.round(contextFreePercent),
        });
  const contextChartConfig = {
    context: {
      label: t("composer.contextFreeUnknown"),
      color: "var(--primary)",
    },
  } satisfies ChartConfig;
  const contextChartData = [
    {
      name: "context",
      value: contextFreePercent ?? 0,
      fill: "var(--color-context)",
    },
  ];

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
      {collaborationModes.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full px-3 text-xs"
              disabled={disabled}
            >
              <Users
                className="h-3.5 w-3.5 text-muted-foreground"
                aria-hidden
              />
              <span className="max-w-[140px] truncate">
                {formatCollaborationModeLabel(
                  collabLabel ?? t("composer.collaboration"),
                )}
              </span>
              <ChevronDown
                className="h-3.5 w-3.5 text-muted-foreground"
                aria-hidden
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup
              value={selectedCollaborationModeId ?? ""}
              onValueChange={(value) =>
                onSelectCollaborationMode(value || null)
              }
            >
              {collaborationModes.map((mode) => (
                <DropdownMenuRadioItem key={mode.id} value={mode.id}>
                  {formatCollaborationModeLabel(mode.label || mode.id)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-full px-3 text-xs"
            disabled={disabled || models.length === 0}
          >
            <Sparkles
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden
            />
            <span className="max-w-[160px] truncate">
              {modelLabel ?? t("composer.noModels")}
            </span>
            <ChevronDown
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuRadioGroup
            value={selectedModelId ?? ""}
            onValueChange={onSelectModel}
          >
            {models.length === 0 && (
              <DropdownMenuRadioItem value="" disabled>
                {t("composer.noModels")}
              </DropdownMenuRadioItem>
            )}
            {models.map((model) => (
              <DropdownMenuRadioItem key={model.id} value={model.id}>
                {model.displayName || model.model}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-full px-3 text-xs"
            disabled={disabled || !reasoningSupported}
          >
            <Brain className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <span className="max-w-[90px] truncate">
              {effortLabel ?? t("composer.default")}
            </span>
            <ChevronDown
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuRadioGroup
            value={selectedEffort ?? ""}
            onValueChange={onSelectEffort}
          >
            {reasoningOptions.length === 0 && (
              <DropdownMenuRadioItem value="" disabled>
                {t("composer.default")}
              </DropdownMenuRadioItem>
            )}
            {reasoningOptions.map((effort) => (
              <DropdownMenuRadioItem key={effort} value={effort}>
                {effort}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-full px-3 text-xs"
            disabled={disabled}
          >
            <ShieldCheck
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden
            />
            <span className="max-w-[120px] truncate">{accessLabel}</span>
            <ChevronDown
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuRadioGroup
            value={accessMode}
            onValueChange={(value) => onSelectAccessMode(value as AccessMode)}
          >
            <DropdownMenuRadioItem value="read-only">
              {t("composer.access.readOnly")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="current">
              {t("composer.access.onRequest")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="full-access">
              {t("composer.access.full")}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex items-center gap-2" style={{marginRight:"-6px"}}>
        <span className="text-xs font-semibold text-muted-foreground">
          {contextUsedPercent === null
            ? "—"
            : `${Math.round(contextUsedPercent)}%`}
        </span>
        <ChartContainer
          config={contextChartConfig}
          className="composer-context-chart"
          aria-label={contextLabel}
          title={contextLabel}
        >
          <RadialBarChart
            data={contextChartData}
            startAngle={90}
            endAngle={-270}
            innerRadius="60%"
            outerRadius="100%"
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              tick={false}
              axisLine={false}
            />
            <RadialBar
              dataKey="value"
              background={{ fill: "var(--surface-control)" }}
              cornerRadius={12}
            />
            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false} />
          </RadialBarChart>
        </ChartContainer>
      </div>
    </div>
  );
}
