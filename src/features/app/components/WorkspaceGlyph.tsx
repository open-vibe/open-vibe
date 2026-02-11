import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Briefcase,
  Code2,
  Database,
  FlaskConical,
  Folder,
  GitBranch,
  Rocket,
  TerminalSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkspaceSettings } from "../../../types";

type WorkspaceGlyphProps = {
  settings: WorkspaceSettings;
  fallbackIcon?: WorkspaceIconName;
  className?: string;
  iconClassName?: string;
};

export type WorkspaceIconName =
  | "folder"
  | "briefcase"
  | "code"
  | "rocket"
  | "flask"
  | "bot"
  | "database"
  | "terminal"
  | "git-branch";

export const WORKSPACE_ICON_OPTIONS: Array<{
  value: WorkspaceIconName;
  label: string;
  Icon: LucideIcon;
}> = [
  { value: "folder", label: "Folder", Icon: Folder },
  { value: "briefcase", label: "Briefcase", Icon: Briefcase },
  { value: "code", label: "Code", Icon: Code2 },
  { value: "rocket", label: "Rocket", Icon: Rocket },
  { value: "flask", label: "Flask", Icon: FlaskConical },
  { value: "bot", label: "Bot", Icon: Bot },
  { value: "database", label: "Database", Icon: Database },
  { value: "terminal", label: "Terminal", Icon: TerminalSquare },
  { value: "git-branch", label: "Branch", Icon: GitBranch },
];

export const WORKSPACE_COLOR_OPTIONS = [
  "#3B82F6",
  "#22C55E",
  "#F97316",
  "#EF4444",
  "#A855F7",
  "#14B8A6",
  "#FACC15",
  "#6B7280",
];

const WORKSPACE_ICON_LOOKUP: Record<WorkspaceIconName, LucideIcon> = {
  folder: Folder,
  briefcase: Briefcase,
  code: Code2,
  rocket: Rocket,
  flask: FlaskConical,
  bot: Bot,
  database: Database,
  terminal: TerminalSquare,
  "git-branch": GitBranch,
};

function normalizeEmoji(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return Array.from(trimmed).slice(0, 2).join("");
}

function normalizeColor(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed;
}

function withAlpha(color: string, alphaHex: string) {
  if (color.startsWith("#") && color.length === 7) {
    return `${color}${alphaHex}`;
  }
  return color;
}

function resolveWorkspaceIconName(
  value: string | null | undefined,
  fallback: WorkspaceIconName,
) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }
  if (trimmed in WORKSPACE_ICON_LOOKUP) {
    return trimmed as WorkspaceIconName;
  }
  return fallback;
}

export function WorkspaceGlyph({
  settings,
  fallbackIcon = "folder",
  className,
  iconClassName,
}: WorkspaceGlyphProps) {
  const emoji = normalizeEmoji(settings.workspaceEmoji);
  const accentColor = normalizeColor(settings.workspaceColor);
  const iconName = resolveWorkspaceIconName(settings.workspaceIcon, fallbackIcon);
  const Icon = WORKSPACE_ICON_LOOKUP[iconName];

  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/40 text-muted-foreground",
        className,
      )}
      style={
        accentColor
          ? {
              color: accentColor,
              backgroundColor: withAlpha(accentColor, "22"),
              borderColor: withAlpha(accentColor, "66"),
            }
          : undefined
      }
      aria-hidden
    >
      {emoji ? (
        <span className="text-[12px] leading-none">{emoji}</span>
      ) : (
        <Icon className={cn("h-3.5 w-3.5", iconClassName)} />
      )}
    </span>
  );
}

