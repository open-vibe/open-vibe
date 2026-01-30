import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ask, open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import LayoutGrid from "lucide-react/dist/esm/icons/layout-grid";
import SlidersHorizontal from "lucide-react/dist/esm/icons/sliders-horizontal";
import Mic from "lucide-react/dist/esm/icons/mic";
import Keyboard from "lucide-react/dist/esm/icons/keyboard";
import Stethoscope from "lucide-react/dist/esm/icons/stethoscope";
import TerminalSquare from "lucide-react/dist/esm/icons/terminal-square";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import X from "lucide-react/dist/esm/icons/x";
import FlaskConical from "lucide-react/dist/esm/icons/flask-conical";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import type {
  AppSettings,
  CodexDoctorResult,
  DictationModelStatus,
  WorkspaceSettings,
  OpenAppTarget,
  WorkspaceGroup,
  WorkspaceInfo,
} from "../../../types";
import { formatDownloadSize } from "../../../utils/formatting";
import {
  buildShortcutValue,
  formatShortcut,
  getDefaultInterruptShortcut,
} from "../../../utils/shortcuts";
import { clampUiScale } from "../../../utils/uiScale";
import { getPlatformKind } from "../../../utils/platform";
import { getCodexConfigPath } from "../../../services/tauri";
import { useI18n } from "../../../i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DEFAULT_CODE_FONT_FAMILY,
  DEFAULT_UI_FONT_FAMILY,
  CODE_FONT_SIZE_DEFAULT,
  CODE_FONT_SIZE_MAX,
  CODE_FONT_SIZE_MIN,
  clampCodeFontSize,
  normalizeFontFamily,
} from "../../../utils/fonts";
import { DEFAULT_OPEN_APP_ID, OPEN_APP_STORAGE_KEY } from "../../app/constants";
import { GENERIC_APP_ICON, getKnownOpenAppIcon } from "../../app/utils/openAppIcons";
import { useGlobalAgentsMd } from "../hooks/useGlobalAgentsMd";
import { useGlobalCodexConfigToml } from "../hooks/useGlobalCodexConfigToml";
import { FileEditorCard } from "../../shared/components/FileEditorCard";

const DICTATION_MODELS = [
  {
    id: "tiny",
    labelKey: "settings.dictation.models.tiny.label",
    size: "75 MB",
    noteKey: "settings.dictation.models.tiny.note",
  },
  {
    id: "base",
    labelKey: "settings.dictation.models.base.label",
    size: "142 MB",
    noteKey: "settings.dictation.models.base.note",
  },
  {
    id: "small",
    labelKey: "settings.dictation.models.small.label",
    size: "466 MB",
    noteKey: "settings.dictation.models.small.note",
  },
  {
    id: "medium",
    labelKey: "settings.dictation.models.medium.label",
    size: "1.5 GB",
    noteKey: "settings.dictation.models.medium.note",
  },
  {
    id: "large-v3",
    labelKey: "settings.dictation.models.largeV3.label",
    size: "3.0 GB",
    noteKey: "settings.dictation.models.largeV3.note",
  },
] as const;

const UNGROUPED_SELECT_VALUE = "__ungrouped__";
const DICTATION_AUTO_VALUE = "__auto__";
const DICTATION_HOLD_OFF_VALUE = "__off__";

type SettingsSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

function SettingsSection({
  title,
  description,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <section
      className={cn(
        "space-y-4 border-b pb-6 last:border-b-0 last:pb-0",
        className,
      )}
    >
      <div className="space-y-1">
        <h3 className="text-base font-semibold leading-none">{title}</h3>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

type ComposerPreset = AppSettings["composerEditorPreset"];

type ComposerPresetSettings = Pick<
  AppSettings,
  | "composerFenceExpandOnSpace"
  | "composerFenceExpandOnEnter"
  | "composerFenceLanguageTags"
  | "composerFenceWrapSelection"
  | "composerFenceAutoWrapPasteMultiline"
  | "composerFenceAutoWrapPasteCodeLike"
  | "composerListContinuation"
  | "composerCodeBlockCopyUseModifier"
>;

const COMPOSER_PRESET_CONFIGS: Record<ComposerPreset, ComposerPresetSettings> = {
  default: {
    composerFenceExpandOnSpace: false,
    composerFenceExpandOnEnter: false,
    composerFenceLanguageTags: false,
    composerFenceWrapSelection: false,
    composerFenceAutoWrapPasteMultiline: false,
    composerFenceAutoWrapPasteCodeLike: false,
    composerListContinuation: false,
    composerCodeBlockCopyUseModifier: false,
  },
  helpful: {
    composerFenceExpandOnSpace: true,
    composerFenceExpandOnEnter: false,
    composerFenceLanguageTags: true,
    composerFenceWrapSelection: true,
    composerFenceAutoWrapPasteMultiline: true,
    composerFenceAutoWrapPasteCodeLike: false,
    composerListContinuation: true,
    composerCodeBlockCopyUseModifier: false,
  },
  smart: {
    composerFenceExpandOnSpace: true,
    composerFenceExpandOnEnter: false,
    composerFenceLanguageTags: true,
    composerFenceWrapSelection: true,
    composerFenceAutoWrapPasteMultiline: true,
    composerFenceAutoWrapPasteCodeLike: true,
    composerListContinuation: true,
    composerCodeBlockCopyUseModifier: false,
  },
};

const normalizeOverrideValue = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const buildWorkspaceOverrideDrafts = (
  projects: WorkspaceInfo[],
  prev: Record<string, string>,
  getValue: (workspace: WorkspaceInfo) => string | null | undefined,
): Record<string, string> => {
  const next: Record<string, string> = {};
  projects.forEach((workspace) => {
    const existing = prev[workspace.id];
    next[workspace.id] = existing ?? getValue(workspace) ?? "";
  });
  return next;
};

export type SettingsViewProps = {
  workspaceGroups: WorkspaceGroup[];
  groupedWorkspaces: Array<{
    id: string | null;
    name: string;
    workspaces: WorkspaceInfo[];
  }>;
  ungroupedLabel: string;
  onClose: () => void;
  onMoveWorkspace: (id: string, direction: "up" | "down") => void;
  onDeleteWorkspace: (id: string) => void;
  onCreateWorkspaceGroup: (name: string) => Promise<WorkspaceGroup | null>;
  onRenameWorkspaceGroup: (id: string, name: string) => Promise<boolean | null>;
  onMoveWorkspaceGroup: (id: string, direction: "up" | "down") => Promise<boolean | null>;
  onDeleteWorkspaceGroup: (id: string) => Promise<boolean | null>;
  onAssignWorkspaceGroup: (
    workspaceId: string,
    groupId: string | null,
  ) => Promise<boolean | null>;
  reduceTransparency: boolean;
  onToggleTransparency: (value: boolean) => void;
  appSettings: AppSettings;
  openAppIconById: Record<string, string>;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  onRunDoctor: (
    codexBin: string | null,
    codexArgs: string | null,
  ) => Promise<CodexDoctorResult>;
  onUpdateWorkspaceCodexBin: (id: string, codexBin: string | null) => Promise<void>;
  onUpdateWorkspaceSettings: (
    id: string,
    settings: Partial<WorkspaceSettings>,
  ) => Promise<void>;
  scaleShortcutTitle: string;
  scaleShortcutText: string;
  onTestNotificationSound: () => void;
  dictationModelStatus?: DictationModelStatus | null;
  onDownloadDictationModel?: () => void;
  onCancelDictationDownload?: () => void;
  onRemoveDictationModel?: () => void;
  initialSection?: CodexSection;
};

type SettingsSection =
  | "projects"
  | "display"
  | "composer"
  | "dictation"
  | "shortcuts"
  | "open-apps";
type CodexSection = SettingsSection | "codex" | "experimental";
type ShortcutSettingKey =
  | "composerModelShortcut"
  | "composerAccessShortcut"
  | "composerReasoningShortcut"
  | "composerCollaborationShortcut"
  | "interruptShortcut"
  | "newAgentShortcut"
  | "newWorktreeAgentShortcut"
  | "newCloneAgentShortcut"
  | "archiveThreadShortcut"
  | "toggleProjectsSidebarShortcut"
  | "toggleGitSidebarShortcut"
  | "toggleDebugPanelShortcut"
  | "toggleTerminalShortcut"
  | "cycleAgentNextShortcut"
  | "cycleAgentPrevShortcut"
  | "cycleWorkspaceNextShortcut"
  | "cycleWorkspacePrevShortcut";
type ShortcutDraftKey =
  | "model"
  | "access"
  | "reasoning"
  | "collaboration"
  | "interrupt"
  | "newAgent"
  | "newWorktreeAgent"
  | "newCloneAgent"
  | "archiveThread"
  | "projectsSidebar"
  | "gitSidebar"
  | "debugPanel"
  | "terminal"
  | "cycleAgentNext"
  | "cycleAgentPrev"
  | "cycleWorkspaceNext"
  | "cycleWorkspacePrev";

type OpenAppDraft = OpenAppTarget & { argsText: string };

const shortcutDraftKeyBySetting: Record<ShortcutSettingKey, ShortcutDraftKey> = {
  composerModelShortcut: "model",
  composerAccessShortcut: "access",
  composerReasoningShortcut: "reasoning",
  composerCollaborationShortcut: "collaboration",
  interruptShortcut: "interrupt",
  newAgentShortcut: "newAgent",
  newWorktreeAgentShortcut: "newWorktreeAgent",
  newCloneAgentShortcut: "newCloneAgent",
  archiveThreadShortcut: "archiveThread",
  toggleProjectsSidebarShortcut: "projectsSidebar",
  toggleGitSidebarShortcut: "gitSidebar",
  toggleDebugPanelShortcut: "debugPanel",
  toggleTerminalShortcut: "terminal",
  cycleAgentNextShortcut: "cycleAgentNext",
  cycleAgentPrevShortcut: "cycleAgentPrev",
  cycleWorkspaceNextShortcut: "cycleWorkspaceNext",
  cycleWorkspacePrevShortcut: "cycleWorkspacePrev",
};

const buildOpenAppDrafts = (targets: OpenAppTarget[]): OpenAppDraft[] =>
  targets.map((target) => ({
    ...target,
    argsText: target.args.join(" "),
  }));

const createOpenAppId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `open-app-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export function SettingsView({
  workspaceGroups,
  groupedWorkspaces,
  ungroupedLabel,
  onClose,
  onMoveWorkspace,
  onDeleteWorkspace,
  onCreateWorkspaceGroup,
  onRenameWorkspaceGroup,
  onMoveWorkspaceGroup,
  onDeleteWorkspaceGroup,
  onAssignWorkspaceGroup,
  reduceTransparency,
  onToggleTransparency,
  appSettings,
  openAppIconById,
  onUpdateAppSettings,
  onRunDoctor,
  onUpdateWorkspaceCodexBin,
  onUpdateWorkspaceSettings,
  scaleShortcutTitle,
  scaleShortcutText,
  onTestNotificationSound,
  dictationModelStatus,
  onDownloadDictationModel,
  onCancelDictationDownload,
  onRemoveDictationModel,
  initialSection,
}: SettingsViewProps) {
  const { t } = useI18n();
  const composerPresetLabels = useMemo<Record<ComposerPreset, string>>(
    () => ({
      default: t("settings.composer.presets.default"),
      helpful: t("settings.composer.presets.helpful"),
      smart: t("settings.composer.presets.smart"),
    }),
    [t],
  );
  type I18nKey = Parameters<typeof t>[0];
  const dictationModels = useMemo(
    () =>
      DICTATION_MODELS.map((model) => ({
        ...model,
        label: t(model.labelKey as I18nKey),
        note: t(model.noteKey as I18nKey),
      })),
    [t],
  );
  const fileManagerLabel = useMemo(() => {
    const platform = getPlatformKind();
    if (platform === "macos") {
      return t("settings.platform.finder");
    }
    if (platform === "windows") {
      return t("settings.platform.fileExplorer");
    }
    return t("settings.platform.fileManager");
  }, [t]);
  const openInFileManagerLabel = useMemo(
    () => t("settings.experimental.openInFileManager", { label: fileManagerLabel }),
    [fileManagerLabel, t],
  );
  const [activeSection, setActiveSection] = useState<CodexSection>("projects");
  const [codexPathDraft, setCodexPathDraft] = useState(appSettings.codexBin ?? "");
  const [codexArgsDraft, setCodexArgsDraft] = useState(appSettings.codexArgs ?? "");
  const [remoteHostDraft, setRemoteHostDraft] = useState(appSettings.remoteBackendHost);
  const [remoteTokenDraft, setRemoteTokenDraft] = useState(appSettings.remoteBackendToken ?? "");
  const [scaleDraft, setScaleDraft] = useState(
    `${Math.round(clampUiScale(appSettings.uiScale) * 100)}%`,
  );
  const [uiFontDraft, setUiFontDraft] = useState(appSettings.uiFontFamily);
  const [codeFontDraft, setCodeFontDraft] = useState(appSettings.codeFontFamily);
  const [codeFontSizeDraft, setCodeFontSizeDraft] = useState(appSettings.codeFontSize);
  const [codexBinOverrideDrafts, setCodexBinOverrideDrafts] = useState<
    Record<string, string>
  >({});
  const [codexHomeOverrideDrafts, setCodexHomeOverrideDrafts] = useState<
    Record<string, string>
  >({});
  const [codexArgsOverrideDrafts, setCodexArgsOverrideDrafts] = useState<
    Record<string, string>
  >({});
  const [groupDrafts, setGroupDrafts] = useState<Record<string, string>>({});
  const [newGroupName, setNewGroupName] = useState("");
  const [groupError, setGroupError] = useState<string | null>(null);
  const [openAppDrafts, setOpenAppDrafts] = useState<OpenAppDraft[]>(() =>
    buildOpenAppDrafts(appSettings.openAppTargets),
  );
  const [openAppSelectedId, setOpenAppSelectedId] = useState(
    appSettings.selectedOpenAppId,
  );
  const [doctorState, setDoctorState] = useState<{
    status: "idle" | "running" | "done";
    result: CodexDoctorResult | null;
  }>({ status: "idle", result: null });
  const {
    content: globalAgentsContent,
    exists: globalAgentsExists,
    truncated: globalAgentsTruncated,
    isLoading: globalAgentsLoading,
    isSaving: globalAgentsSaving,
    error: globalAgentsError,
    isDirty: globalAgentsDirty,
    setContent: setGlobalAgentsContent,
    refresh: refreshGlobalAgents,
    save: saveGlobalAgents,
  } = useGlobalAgentsMd();
  const {
    content: globalConfigContent,
    exists: globalConfigExists,
    truncated: globalConfigTruncated,
    isLoading: globalConfigLoading,
    isSaving: globalConfigSaving,
    error: globalConfigError,
    isDirty: globalConfigDirty,
    setContent: setGlobalConfigContent,
    refresh: refreshGlobalConfig,
    save: saveGlobalConfig,
  } = useGlobalCodexConfigToml();
  const [openConfigError, setOpenConfigError] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [shortcutDrafts, setShortcutDrafts] = useState({
    model: appSettings.composerModelShortcut ?? "",
    access: appSettings.composerAccessShortcut ?? "",
    reasoning: appSettings.composerReasoningShortcut ?? "",
    collaboration: appSettings.composerCollaborationShortcut ?? "",
    interrupt: appSettings.interruptShortcut ?? "",
    newAgent: appSettings.newAgentShortcut ?? "",
    newWorktreeAgent: appSettings.newWorktreeAgentShortcut ?? "",
    newCloneAgent: appSettings.newCloneAgentShortcut ?? "",
    archiveThread: appSettings.archiveThreadShortcut ?? "",
    projectsSidebar: appSettings.toggleProjectsSidebarShortcut ?? "",
    gitSidebar: appSettings.toggleGitSidebarShortcut ?? "",
    debugPanel: appSettings.toggleDebugPanelShortcut ?? "",
    terminal: appSettings.toggleTerminalShortcut ?? "",
    cycleAgentNext: appSettings.cycleAgentNextShortcut ?? "",
    cycleAgentPrev: appSettings.cycleAgentPrevShortcut ?? "",
    cycleWorkspaceNext: appSettings.cycleWorkspaceNextShortcut ?? "",
    cycleWorkspacePrev: appSettings.cycleWorkspacePrevShortcut ?? "",
  });
  const dictationReady = dictationModelStatus?.state === "ready";
  const dictationProgress = dictationModelStatus?.progress ?? null;
  const globalAgentsStatus = globalAgentsLoading
    ? t("settings.status.loading")
    : globalAgentsSaving
      ? t("settings.status.saving")
      : globalAgentsExists
        ? ""
        : t("settings.status.notFound");
  const globalAgentsMetaParts: string[] = [];
  if (globalAgentsStatus) {
    globalAgentsMetaParts.push(globalAgentsStatus);
  }
  if (globalAgentsTruncated) {
    globalAgentsMetaParts.push(t("settings.status.truncated"));
  }
  const globalAgentsMeta = globalAgentsMetaParts.join(" · ");
  const globalAgentsSaveLabel = globalAgentsExists
    ? t("settings.action.save")
    : t("settings.action.create");
  const globalAgentsSaveDisabled = globalAgentsLoading || globalAgentsSaving || !globalAgentsDirty;
  const globalAgentsRefreshDisabled = globalAgentsLoading || globalAgentsSaving;
  const globalConfigStatus = globalConfigLoading
    ? t("settings.status.loading")
    : globalConfigSaving
      ? t("settings.status.saving")
      : globalConfigExists
        ? ""
        : t("settings.status.notFound");
  const globalConfigMetaParts: string[] = [];
  if (globalConfigStatus) {
    globalConfigMetaParts.push(globalConfigStatus);
  }
  if (globalConfigTruncated) {
    globalConfigMetaParts.push(t("settings.status.truncated"));
  }
  const globalConfigMeta = globalConfigMetaParts.join(" · ");
  const globalConfigSaveLabel = globalConfigExists
    ? t("settings.action.save")
    : t("settings.action.create");
  const globalConfigSaveDisabled = globalConfigLoading || globalConfigSaving || !globalConfigDirty;
  const globalConfigRefreshDisabled = globalConfigLoading || globalConfigSaving;
  const selectedDictationModel = useMemo(() => {
    return (
      dictationModels.find(
        (model) => model.id === appSettings.dictationModelId,
      ) ?? dictationModels[1]
    );
  }, [appSettings.dictationModelId, dictationModels]);

  const projects = useMemo(
    () => groupedWorkspaces.flatMap((group) => group.workspaces),
    [groupedWorkspaces],
  );
  const hasCodexHomeOverrides = useMemo(
    () => projects.some((workspace) => workspace.settings.codexHome != null),
    [projects],
  );

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      onClose();
    };

    const handleCloseShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "w") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    window.addEventListener("keydown", handleCloseShortcut);
    return () => {
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("keydown", handleCloseShortcut);
    };
  }, [onClose]);

  useEffect(() => {
    setCodexPathDraft(appSettings.codexBin ?? "");
  }, [appSettings.codexBin]);

  useEffect(() => {
    setCodexArgsDraft(appSettings.codexArgs ?? "");
  }, [appSettings.codexArgs]);

  useEffect(() => {
    setRemoteHostDraft(appSettings.remoteBackendHost);
  }, [appSettings.remoteBackendHost]);

  useEffect(() => {
    setRemoteTokenDraft(appSettings.remoteBackendToken ?? "");
  }, [appSettings.remoteBackendToken]);

  useEffect(() => {
    setScaleDraft(`${Math.round(clampUiScale(appSettings.uiScale) * 100)}%`);
  }, [appSettings.uiScale]);

  useEffect(() => {
    setUiFontDraft(appSettings.uiFontFamily);
  }, [appSettings.uiFontFamily]);

  useEffect(() => {
    setCodeFontDraft(appSettings.codeFontFamily);
  }, [appSettings.codeFontFamily]);

  useEffect(() => {
    setCodeFontSizeDraft(appSettings.codeFontSize);
  }, [appSettings.codeFontSize]);

  useEffect(() => {
    setOpenAppDrafts(buildOpenAppDrafts(appSettings.openAppTargets));
    setOpenAppSelectedId(appSettings.selectedOpenAppId);
  }, [appSettings.openAppTargets, appSettings.selectedOpenAppId]);

  useEffect(() => {
    setShortcutDrafts({
      model: appSettings.composerModelShortcut ?? "",
      access: appSettings.composerAccessShortcut ?? "",
      reasoning: appSettings.composerReasoningShortcut ?? "",
      collaboration: appSettings.composerCollaborationShortcut ?? "",
      interrupt: appSettings.interruptShortcut ?? "",
      newAgent: appSettings.newAgentShortcut ?? "",
      newWorktreeAgent: appSettings.newWorktreeAgentShortcut ?? "",
      newCloneAgent: appSettings.newCloneAgentShortcut ?? "",
      archiveThread: appSettings.archiveThreadShortcut ?? "",
      projectsSidebar: appSettings.toggleProjectsSidebarShortcut ?? "",
      gitSidebar: appSettings.toggleGitSidebarShortcut ?? "",
      debugPanel: appSettings.toggleDebugPanelShortcut ?? "",
      terminal: appSettings.toggleTerminalShortcut ?? "",
      cycleAgentNext: appSettings.cycleAgentNextShortcut ?? "",
      cycleAgentPrev: appSettings.cycleAgentPrevShortcut ?? "",
      cycleWorkspaceNext: appSettings.cycleWorkspaceNextShortcut ?? "",
      cycleWorkspacePrev: appSettings.cycleWorkspacePrevShortcut ?? "",
    });
  }, [
    appSettings.composerAccessShortcut,
    appSettings.composerModelShortcut,
    appSettings.composerReasoningShortcut,
    appSettings.composerCollaborationShortcut,
    appSettings.interruptShortcut,
    appSettings.newAgentShortcut,
    appSettings.newWorktreeAgentShortcut,
    appSettings.newCloneAgentShortcut,
    appSettings.archiveThreadShortcut,
    appSettings.toggleProjectsSidebarShortcut,
    appSettings.toggleGitSidebarShortcut,
    appSettings.toggleDebugPanelShortcut,
    appSettings.toggleTerminalShortcut,
    appSettings.cycleAgentNextShortcut,
    appSettings.cycleAgentPrevShortcut,
    appSettings.cycleWorkspaceNextShortcut,
    appSettings.cycleWorkspacePrevShortcut,
  ]);

  const handleOpenConfig = useCallback(async () => {
    setOpenConfigError(null);
    try {
      const configPath = await getCodexConfigPath();
      await revealItemInDir(configPath);
    } catch (error) {
      setOpenConfigError(
        error instanceof Error ? error.message : t("settings.error.openConfig"),
      );
    }
  }, [t]);

  useEffect(() => {
    setCodexBinOverrideDrafts((prev) =>
      buildWorkspaceOverrideDrafts(
        projects,
        prev,
        (workspace) => workspace.codex_bin ?? null,
      ),
    );
    setCodexHomeOverrideDrafts((prev) =>
      buildWorkspaceOverrideDrafts(
        projects,
        prev,
        (workspace) => workspace.settings.codexHome ?? null,
      ),
    );
    setCodexArgsOverrideDrafts((prev) =>
      buildWorkspaceOverrideDrafts(
        projects,
        prev,
        (workspace) => workspace.settings.codexArgs ?? null,
      ),
    );
  }, [projects]);

  useEffect(() => {
    setGroupDrafts((prev) => {
      const next: Record<string, string> = {};
      workspaceGroups.forEach((group) => {
        next[group.id] = prev[group.id] ?? group.name;
      });
      return next;
    });
  }, [workspaceGroups]);

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  const nextCodexBin = codexPathDraft.trim() ? codexPathDraft.trim() : null;
  const nextCodexArgs = codexArgsDraft.trim() ? codexArgsDraft.trim() : null;
  const codexDirty =
    nextCodexBin !== (appSettings.codexBin ?? null) ||
    nextCodexArgs !== (appSettings.codexArgs ?? null);

  const trimmedScale = scaleDraft.trim();
  const parsedPercent = trimmedScale
    ? Number(trimmedScale.replace("%", ""))
    : Number.NaN;
  const parsedScale = Number.isFinite(parsedPercent) ? parsedPercent / 100 : null;

  const handleSaveCodexSettings = async () => {
    setIsSavingSettings(true);
    try {
      await onUpdateAppSettings({
        ...appSettings,
        codexBin: nextCodexBin,
        codexArgs: nextCodexArgs,
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCommitRemoteHost = async () => {
    const nextHost = remoteHostDraft.trim() || "127.0.0.1:4732";
    setRemoteHostDraft(nextHost);
    if (nextHost === appSettings.remoteBackendHost) {
      return;
    }
    await onUpdateAppSettings({
      ...appSettings,
      remoteBackendHost: nextHost,
    });
  };

  const handleCommitRemoteToken = async () => {
    const nextToken = remoteTokenDraft.trim() ? remoteTokenDraft.trim() : null;
    setRemoteTokenDraft(nextToken ?? "");
    if (nextToken === appSettings.remoteBackendToken) {
      return;
    }
    await onUpdateAppSettings({
      ...appSettings,
      remoteBackendToken: nextToken,
    });
  };

  const handleCommitScale = async () => {
    if (parsedScale === null) {
      setScaleDraft(`${Math.round(clampUiScale(appSettings.uiScale) * 100)}%`);
      return;
    }
    const nextScale = clampUiScale(parsedScale);
    setScaleDraft(`${Math.round(nextScale * 100)}%`);
    if (nextScale === appSettings.uiScale) {
      return;
    }
    await onUpdateAppSettings({
      ...appSettings,
      uiScale: nextScale,
    });
  };

  const handleResetScale = async () => {
    if (appSettings.uiScale === 1) {
      setScaleDraft("100%");
      return;
    }
    setScaleDraft("100%");
    await onUpdateAppSettings({
      ...appSettings,
      uiScale: 1,
    });
  };

  const handleCommitUiFont = async () => {
    const nextFont = normalizeFontFamily(
      uiFontDraft,
      DEFAULT_UI_FONT_FAMILY,
    );
    setUiFontDraft(nextFont);
    if (nextFont === appSettings.uiFontFamily) {
      return;
    }
    await onUpdateAppSettings({
      ...appSettings,
      uiFontFamily: nextFont,
    });
  };

  const handleCommitCodeFont = async () => {
    const nextFont = normalizeFontFamily(
      codeFontDraft,
      DEFAULT_CODE_FONT_FAMILY,
    );
    setCodeFontDraft(nextFont);
    if (nextFont === appSettings.codeFontFamily) {
      return;
    }
    await onUpdateAppSettings({
      ...appSettings,
      codeFontFamily: nextFont,
    });
  };

  const handleCommitCodeFontSize = async (nextSize: number) => {
    const clampedSize = clampCodeFontSize(nextSize);
    setCodeFontSizeDraft(clampedSize);
    if (clampedSize === appSettings.codeFontSize) {
      return;
    }
    await onUpdateAppSettings({
      ...appSettings,
      codeFontSize: clampedSize,
    });
  };

  const normalizeOpenAppTargets = useCallback(
    (drafts: OpenAppDraft[]): OpenAppTarget[] =>
      drafts.map(({ argsText, ...target }) => ({
        ...target,
        label: target.label.trim(),
        appName: (target.appName?.trim() ?? "") || null,
        command: (target.command?.trim() ?? "") || null,
        args: argsText.trim() ? argsText.trim().split(/\s+/) : [],
      })),
    [],
  );

  const handleCommitOpenApps = useCallback(
    async (drafts: OpenAppDraft[], selectedId = openAppSelectedId) => {
      const nextTargets = normalizeOpenAppTargets(drafts);
      const nextSelectedId =
        nextTargets.find((target) => target.id === selectedId)?.id ??
        nextTargets[0]?.id ??
        DEFAULT_OPEN_APP_ID;
      setOpenAppDrafts(buildOpenAppDrafts(nextTargets));
      setOpenAppSelectedId(nextSelectedId);
      await onUpdateAppSettings({
        ...appSettings,
        openAppTargets: nextTargets,
        selectedOpenAppId: nextSelectedId,
      });
    },
    [
      appSettings,
      normalizeOpenAppTargets,
      onUpdateAppSettings,
      openAppSelectedId,
    ],
  );

  const handleOpenAppDraftChange = (
    index: number,
    updates: Partial<OpenAppDraft>,
  ) => {
    setOpenAppDrafts((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) {
        return prev;
      }
      next[index] = { ...current, ...updates };
      return next;
    });
  };

  const handleOpenAppKindChange = (index: number, kind: OpenAppTarget["kind"]) => {
    setOpenAppDrafts((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) {
        return prev;
      }
      next[index] = {
        ...current,
        kind,
        appName: kind === "app" ? current.appName ?? "" : null,
        command: kind === "command" ? current.command ?? "" : null,
        argsText: kind === "finder" ? "" : current.argsText,
      };
      void handleCommitOpenApps(next);
      return next;
    });
  };

  const handleMoveOpenApp = (index: number, direction: "up" | "down") => {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= openAppDrafts.length) {
      return;
    }
    const next = [...openAppDrafts];
    const [moved] = next.splice(index, 1);
    next.splice(nextIndex, 0, moved);
    setOpenAppDrafts(next);
    void handleCommitOpenApps(next);
  };

  const handleDeleteOpenApp = (index: number) => {
    if (openAppDrafts.length <= 1) {
      return;
    }
    const removed = openAppDrafts[index];
    const next = openAppDrafts.filter((_, draftIndex) => draftIndex !== index);
    const nextSelected =
      removed?.id === openAppSelectedId ? next[0]?.id ?? DEFAULT_OPEN_APP_ID : openAppSelectedId;
    setOpenAppDrafts(next);
    void handleCommitOpenApps(next, nextSelected);
  };

  const handleAddOpenApp = () => {
    const newTarget: OpenAppDraft = {
      id: createOpenAppId(),
      label: t("settings.openApps.newApp"),
      kind: "app",
      appName: "",
      command: null,
      args: [],
      argsText: "",
    };
    const next = [...openAppDrafts, newTarget];
    setOpenAppDrafts(next);
    void handleCommitOpenApps(next, newTarget.id);
  };

  const handleSelectOpenAppDefault = (id: string) => {
    setOpenAppSelectedId(id);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(OPEN_APP_STORAGE_KEY, id);
    }
    void handleCommitOpenApps(openAppDrafts, id);
  };

  const handleComposerPresetChange = (preset: ComposerPreset) => {
    const config = COMPOSER_PRESET_CONFIGS[preset];
    void onUpdateAppSettings({
      ...appSettings,
      composerEditorPreset: preset,
      ...config,
    });
  };

  const handleBrowseCodex = async () => {
    const selection = await open({ multiple: false, directory: false });
    if (!selection || Array.isArray(selection)) {
      return;
    }
    setCodexPathDraft(selection);
  };

  const handleRunDoctor = async () => {
    setDoctorState({ status: "running", result: null });
    try {
      const result = await onRunDoctor(nextCodexBin, nextCodexArgs);
      setDoctorState({ status: "done", result });
    } catch (error) {
      setDoctorState({
        status: "done",
        result: {
          ok: false,
          codexBin: nextCodexBin,
          version: null,
          appServerOk: false,
          details: error instanceof Error ? error.message : String(error),
          path: null,
          nodeOk: false,
          nodeVersion: null,
          nodeDetails: null,
        },
      });
    }
  };

  const updateShortcut = async (key: ShortcutSettingKey, value: string | null) => {
    const draftKey = shortcutDraftKeyBySetting[key];
    setShortcutDrafts((prev) => ({
      ...prev,
      [draftKey]: value ?? "",
    }));
    await onUpdateAppSettings({
      ...appSettings,
      [key]: value,
    });
  };

  const handleShortcutKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    key: ShortcutSettingKey,
  ) => {
    if (event.key === "Tab" && key !== "composerCollaborationShortcut") {
      return;
    }
    if (event.key === "Tab" && !event.shiftKey) {
      return;
    }
    event.preventDefault();
    if (event.key === "Backspace" || event.key === "Delete") {
      void updateShortcut(key, null);
      return;
    }
    const value = buildShortcutValue(event.nativeEvent);
    if (!value) {
      return;
    }
    void updateShortcut(key, value);
  };

  const trimmedGroupName = newGroupName.trim();
  const canCreateGroup = Boolean(trimmedGroupName);

  const handleCreateGroup = async () => {
    setGroupError(null);
    try {
      const created = await onCreateWorkspaceGroup(newGroupName);
      if (created) {
        setNewGroupName("");
      }
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleRenameGroup = async (group: WorkspaceGroup) => {
    const draft = groupDrafts[group.id] ?? "";
    const trimmed = draft.trim();
    if (!trimmed || trimmed === group.name) {
      setGroupDrafts((prev) => ({
        ...prev,
        [group.id]: group.name,
      }));
      return;
    }
    setGroupError(null);
    try {
      await onRenameWorkspaceGroup(group.id, trimmed);
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : String(error));
      setGroupDrafts((prev) => ({
        ...prev,
        [group.id]: group.name,
      }));
    }
  };

  const updateGroupCopiesFolder = async (
    groupId: string,
    copiesFolder: string | null,
  ) => {
    setGroupError(null);
    try {
      await onUpdateAppSettings({
        ...appSettings,
        workspaceGroups: appSettings.workspaceGroups.map((entry) =>
          entry.id === groupId ? { ...entry, copiesFolder } : entry,
        ),
      });
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleChooseGroupCopiesFolder = async (group: WorkspaceGroup) => {
    const selection = await open({ multiple: false, directory: true });
    if (!selection || Array.isArray(selection)) {
      return;
    }
    await updateGroupCopiesFolder(group.id, selection);
  };

  const handleClearGroupCopiesFolder = async (group: WorkspaceGroup) => {
    if (!group.copiesFolder) {
      return;
    }
    await updateGroupCopiesFolder(group.id, null);
  };

  const handleDeleteGroup = async (group: WorkspaceGroup) => {
    const groupProjects =
      groupedWorkspaces.find((entry) => entry.id === group.id)?.workspaces ?? [];
    const detail =
      groupProjects.length > 0
        ? `\n\n${t("settings.projects.group.deleteDetail", { label: ungroupedLabel })}`
        : "";
    const confirmed = await ask(
      `${t("settings.projects.group.deletePrompt", { name: group.name })}${detail}`,
      {
        title: t("settings.projects.group.deleteTitle"),
        kind: "warning",
        okLabel: t("settings.projects.group.deleteConfirm"),
        cancelLabel: t("settings.projects.group.deleteCancel"),
      },
    );
    if (!confirmed) {
      return;
    }
    setGroupError(null);
    try {
      await onDeleteWorkspaceGroup(group.id);
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
      <div
        className="fixed inset-0 z-50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="absolute inset-0 flex items-start justify-start overflow-hidden p-6">
          <div className="relative z-10 flex h-[calc(100vh-3rem)] w-full max-w-none flex-col overflow-hidden rounded-xl border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 id="settings-title" className="text-lg font-semibold">
                {t("settings.title")}
              </h2>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={onClose}
                aria-label={t("settings.close")}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            <Tabs
              value={activeSection}
              onValueChange={(value) => setActiveSection(value as CodexSection)}
              className="flex min-h-0 flex-1"
            >
              <TabsList className="h-full w-60 flex-col items-stretch gap-1 overflow-y-auto rounded-none border-r bg-transparent p-2 text-sm text-muted-foreground">
                <TabsTrigger
                  value="projects"
                  className="justify-start gap-2 data-[state=active]:bg-muted/60 data-[state=active]:shadow-none"
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden />
                  <span>{t("settings.nav.projects")}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="display"
                  className="justify-start gap-2 data-[state=active]:bg-muted/60 data-[state=active]:shadow-none"
                >
                  <SlidersHorizontal className="h-4 w-4" aria-hidden />
                  <span>{t("settings.nav.displaySound")}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="composer"
                  className="justify-start gap-2 data-[state=active]:bg-muted/60 data-[state=active]:shadow-none"
                >
                  <FileText className="h-4 w-4" aria-hidden />
                  <span>{t("settings.nav.composer")}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="dictation"
                  className="justify-start gap-2 data-[state=active]:bg-muted/60 data-[state=active]:shadow-none"
                >
                  <Mic className="h-4 w-4" aria-hidden />
                  <span>{t("settings.nav.dictation")}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="shortcuts"
                  className="justify-start gap-2 data-[state=active]:bg-muted/60 data-[state=active]:shadow-none"
                >
                  <Keyboard className="h-4 w-4" aria-hidden />
                  <span>{t("settings.nav.shortcuts")}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="open-apps"
                  className="justify-start gap-2 data-[state=active]:bg-muted/60 data-[state=active]:shadow-none"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  <span>{t("settings.nav.openIn")}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="codex"
                  className="justify-start gap-2 data-[state=active]:bg-muted/60 data-[state=active]:shadow-none"
                >
                  <TerminalSquare className="h-4 w-4" aria-hidden />
                  <span>{t("settings.nav.codex")}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="experimental"
                  className="justify-start gap-2 data-[state=active]:bg-muted/60 data-[state=active]:shadow-none"
                >
                  <FlaskConical className="h-4 w-4" aria-hidden />
                  <span>{t("settings.nav.experimental")}</span>
                </TabsTrigger>
              </TabsList>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
                <TabsContent value="projects" className="mt-0">
                  <div className="space-y-4">
                    <SettingsSection
                      title={t("settings.projects.title")}
                      description={t("settings.projects.subtitle")}
                    >
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {t("settings.projects.groups.title")}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.projects.groups.subtitle")}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            className="min-w-[220px] flex-1"
                            value={newGroupName}
                            placeholder={t("settings.projects.groupName.placeholder")}
                            aria-label={t("settings.projects.groupName.placeholder")}
                            onChange={(event) => setNewGroupName(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && canCreateGroup) {
                                event.preventDefault();
                                void handleCreateGroup();
                              }
                            }}
                          />
                          <Button
                            type="button"
                            onClick={() => {
                              void handleCreateGroup();
                            }}
                            disabled={!canCreateGroup}
                          >
                            {t("settings.projects.group.add")}
                          </Button>
                        </div>
                        {groupError && (
                          <div className="text-sm text-destructive">{groupError}</div>
                        )}
                        {workspaceGroups.length > 0 ? (
                          <div className="space-y-3">
                            {workspaceGroups.map((group, index) => (
                              <div key={group.id} className="rounded-md border border-border/60 p-3">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                  <div className="flex-1 min-w-[220px] space-y-3">
                                    <Input
                                      value={groupDrafts[group.id] ?? group.name}
                                      aria-label={t("settings.projects.groupName.placeholder")}
                                      onChange={(event) =>
                                        setGroupDrafts((prev) => ({
                                          ...prev,
                                          [group.id]: event.target.value,
                                        }))
                                      }
                                      onBlur={() => {
                                        void handleRenameGroup(group);
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                          event.preventDefault();
                                          void handleRenameGroup(group);
                                        }
                                      }}
                                    />
                                    <div className="space-y-2">
                                      <div className="text-sm font-medium">
                                        {t("settings.projects.group.copiesFolder")}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <div
                                          className={cn(
                                            "flex-1 min-w-[200px] truncate rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs",
                                            !group.copiesFolder && "text-muted-foreground",
                                          )}
                                          title={group.copiesFolder ?? ""}
                                        >
                                          {group.copiesFolder ??
                                            t("settings.projects.group.notSet")}
                                        </div>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            void handleChooseGroupCopiesFolder(group);
                                          }}
                                        >
                                          {t("settings.projects.group.choose")}
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            void handleClearGroupCopiesFolder(group);
                                          }}
                                          disabled={!group.copiesFolder}
                                        >
                                          {t("settings.projects.group.clear")}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      className="text-muted-foreground hover:text-foreground"
                                      onClick={() => {
                                        void onMoveWorkspaceGroup(group.id, "up");
                                      }}
                                      disabled={index === 0}
                                      aria-label={t("settings.projects.group.moveUp")}
                                    >
                                      <ChevronUp className="h-4 w-4" aria-hidden />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      className="text-muted-foreground hover:text-foreground"
                                      onClick={() => {
                                        void onMoveWorkspaceGroup(group.id, "down");
                                      }}
                                      disabled={index === workspaceGroups.length - 1}
                                      aria-label={t("settings.projects.group.moveDown")}
                                    >
                                      <ChevronDown className="h-4 w-4" aria-hidden />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      className="text-muted-foreground hover:text-foreground"
                                      onClick={() => {
                                        void handleDeleteGroup(group);
                                      }}
                                      aria-label={t("settings.projects.group.delete")}
                                    >
                                      <Trash2 className="h-4 w-4" aria-hidden />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            {t("settings.projects.group.empty")}
                          </div>
                        )}
                      </div>
                      <Separator />
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {t("settings.projects.projects.title")}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.projects.projects.subtitle")}
                          </div>
                        </div>
                        <div className="space-y-3">
                          {groupedWorkspaces.map((group) => (
                            <div key={group.id ?? "ungrouped"} className="space-y-2">
                              <div className="text-xs font-semibold uppercase text-muted-foreground">
                                {group.name}
                              </div>
                              <div className="space-y-2">
                                {group.workspaces.map((workspace, index) => {
                                  const groupValue = workspaceGroups.some(
                                    (entry) => entry.id === workspace.settings.groupId,
                                  )
                                    ? workspace.settings.groupId ?? UNGROUPED_SELECT_VALUE
                                    : UNGROUPED_SELECT_VALUE;
                                  return (
                                    <div
                                      key={workspace.id}
                                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 p-3"
                                    >
                                      <div className="min-w-[220px]">
                                        <div className="text-sm font-medium">
                                          {workspace.name}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          {workspace.path}
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Select
                                          value={groupValue}
                                          onValueChange={(value) => {
                                            const nextGroupId =
                                              value === UNGROUPED_SELECT_VALUE ? null : value;
                                            void onAssignWorkspaceGroup(workspace.id, nextGroupId);
                                          }}
                                        >
                                          <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder={ungroupedLabel} />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value={UNGROUPED_SELECT_VALUE}>
                                              {ungroupedLabel}
                                            </SelectItem>
                                            {workspaceGroups.map((entry) => (
                                              <SelectItem key={entry.id} value={entry.id}>
                                                {entry.name}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon-sm"
                                          className="text-muted-foreground hover:text-foreground"
                                          onClick={() => onMoveWorkspace(workspace.id, "up")}
                                          disabled={index === 0}
                                          aria-label={t("settings.projects.project.moveUp")}
                                        >
                                          <ChevronUp className="h-4 w-4" aria-hidden />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon-sm"
                                          className="text-muted-foreground hover:text-foreground"
                                          onClick={() => onMoveWorkspace(workspace.id, "down")}
                                          disabled={index === group.workspaces.length - 1}
                                          aria-label={t("settings.projects.project.moveDown")}
                                        >
                                          <ChevronDown className="h-4 w-4" aria-hidden />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon-sm"
                                          className="text-muted-foreground hover:text-foreground"
                                          onClick={() => onDeleteWorkspace(workspace.id)}
                                          aria-label={t("settings.projects.project.delete")}
                                        >
                                          <Trash2 className="h-4 w-4" aria-hidden />
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        {projects.length === 0 && (
                          <div className="text-sm text-muted-foreground">
                            {t("settings.projects.project.empty")}
                          </div>
                        )}
                      </div>
                    </div>
                    </SettingsSection>
                  </div>
                </TabsContent>
                <TabsContent value="display" className="mt-0">
                  <div className="space-y-4">
                    <SettingsSection
                      title={t("settings.display.title")}
                      description={t("settings.display.subtitle")}
                    >
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {t("settings.display.section.title")}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.display.section.subtitle")}
                          </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="theme-select">
                              {t("settings.display.theme.label")}
                            </Label>
                            <Select
                              value={appSettings.theme}
                              onValueChange={(value) =>
                                void onUpdateAppSettings({
                                  ...appSettings,
                                  theme: value as AppSettings["theme"],
                                })
                              }
                            >
                              <SelectTrigger id="theme-select">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="system">
                                  {t("settings.display.theme.system")}
                                </SelectItem>
                                <SelectItem value="light">
                                  {t("settings.display.theme.light")}
                                </SelectItem>
                                <SelectItem value="dark">
                                  {t("settings.display.theme.dark")}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="language-select">
                              {t("settings.language.label")}
                            </Label>
                            <Select
                              value={appSettings.language}
                              onValueChange={(value) =>
                                void onUpdateAppSettings({
                                  ...appSettings,
                                  language: value as AppSettings["language"],
                                })
                              }
                            >
                              <SelectTrigger id="language-select">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="system">{t("language.system")}</SelectItem>
                                <SelectItem value="en">{t("language.english")}</SelectItem>
                                <SelectItem value="zh-CN">{t("language.chinese")}</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="text-sm text-muted-foreground">
                              {t("settings.language.help")}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                          <div className="space-y-1">
                            <Label htmlFor="reduce-transparency">
                              {t("settings.display.reduceTransparency.title")}
                            </Label>
                            <div className="text-sm text-muted-foreground">
                              {t("settings.display.reduceTransparency.subtitle")}
                            </div>
                          </div>
                          <Switch
                            id="reduce-transparency"
                            checked={reduceTransparency}
                            onCheckedChange={(value) => onToggleTransparency(value)}
                          />
                        </div>
                        <div className="rounded-md border border-border/60 p-3">
                          <div className="space-y-2">
                            <Label htmlFor="ui-scale">
                              {t("settings.display.interfaceScale.title")}
                            </Label>
                            <div
                              className="text-sm text-muted-foreground"
                              title={scaleShortcutTitle}
                            >
                              {scaleShortcutText}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                id="ui-scale"
                                type="text"
                                inputMode="decimal"
                                className="w-24"
                                value={scaleDraft}
                                aria-label={t("settings.display.interfaceScale.label")}
                                onChange={(event) => setScaleDraft(event.target.value)}
                                onBlur={() => {
                                  void handleCommitScale();
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    void handleCommitScale();
                                  }
                                }}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  void handleResetScale();
                                }}
                              >
                                {t("settings.display.reset")}
                              </Button>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-md border border-border/60 p-3">
                          <div className="space-y-2">
                            <Label htmlFor="ui-font-family">
                              {t("settings.display.uiFont.label")}
                            </Label>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                id="ui-font-family"
                                type="text"
                                value={uiFontDraft}
                                onChange={(event) => setUiFontDraft(event.target.value)}
                                onBlur={() => {
                                  void handleCommitUiFont();
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    void handleCommitUiFont();
                                  }
                                }}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setUiFontDraft(DEFAULT_UI_FONT_FAMILY);
                                  void onUpdateAppSettings({
                                    ...appSettings,
                                    uiFontFamily: DEFAULT_UI_FONT_FAMILY,
                                  });
                                }}
                              >
                                {t("settings.display.reset")}
                              </Button>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {t("settings.display.uiFont.help")}
                            </div>
                          </div>
                        </div>
                        <div className="rounded-md border border-border/60 p-3">
                          <div className="space-y-2">
                            <Label htmlFor="code-font-family">
                              {t("settings.display.codeFont.label")}
                            </Label>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                id="code-font-family"
                                type="text"
                                value={codeFontDraft}
                                onChange={(event) => setCodeFontDraft(event.target.value)}
                                onBlur={() => {
                                  void handleCommitCodeFont();
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    void handleCommitCodeFont();
                                  }
                                }}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setCodeFontDraft(DEFAULT_CODE_FONT_FAMILY);
                                  void onUpdateAppSettings({
                                    ...appSettings,
                                    codeFontFamily: DEFAULT_CODE_FONT_FAMILY,
                                  });
                                }}
                              >
                                {t("settings.display.reset")}
                              </Button>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {t("settings.display.codeFont.help")}
                            </div>
                          </div>
                        </div>
                        <div className="rounded-md border border-border/60 p-3">
                          <div className="space-y-2">
                            <Label htmlFor="code-font-size">
                              {t("settings.display.codeFontSize.label")}
                            </Label>
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                id="code-font-size"
                                type="range"
                                min={CODE_FONT_SIZE_MIN}
                                max={CODE_FONT_SIZE_MAX}
                                step={1}
                                className="h-2 w-40"
                                value={codeFontSizeDraft}
                                onChange={(event) => {
                                  const nextValue = Number(event.target.value);
                                  setCodeFontSizeDraft(nextValue);
                                  void handleCommitCodeFontSize(nextValue);
                                }}
                              />
                              <div className="text-sm text-muted-foreground">
                                {codeFontSizeDraft}px
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setCodeFontSizeDraft(CODE_FONT_SIZE_DEFAULT);
                                  void handleCommitCodeFontSize(CODE_FONT_SIZE_DEFAULT);
                                }}
                              >
                                {t("settings.display.reset")}
                              </Button>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {t("settings.display.codeFontSize.help")}
                            </div>
                          </div>
                        </div>
                      </div>
                      <Separator />
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {t("settings.display.sounds.title")}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.display.sounds.subtitle")}
                          </div>
                        </div>
                        <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                          <div className="space-y-1">
                            <Label htmlFor="notification-sounds">
                              {t("settings.display.notificationSounds.title")}
                            </Label>
                            <div className="text-sm text-muted-foreground">
                              {t("settings.display.notificationSounds.subtitle")}
                            </div>
                          </div>
                          <Switch
                            id="notification-sounds"
                            checked={appSettings.notificationSoundsEnabled}
                            onCheckedChange={(value) =>
                              void onUpdateAppSettings({
                                ...appSettings,
                                notificationSoundsEnabled: value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={onTestNotificationSound}
                          >
                            {t("settings.display.testSound")}
                          </Button>
                        </div>
                      </div>
                    </SettingsSection>
                  </div>
                </TabsContent>
                <TabsContent value="composer" className="mt-0">
                  <div className="space-y-4">
                    <SettingsSection
                      title={t("settings.composer.title")}
                      description={t("settings.composer.subtitle")}
                    >
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {t("settings.composer.presets.title")}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.composer.presets.subtitle")}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="composer-preset">
                            {t("settings.composer.presets.label")}
                          </Label>
                          <Select
                            value={appSettings.composerEditorPreset}
                            onValueChange={(value) =>
                              handleComposerPresetChange(value as ComposerPreset)
                            }
                          >
                            <SelectTrigger id="composer-preset">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(composerPresetLabels).map(([preset, label]) => (
                                <SelectItem key={preset} value={preset}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.composer.presets.help")}
                          </div>
                        </div>
                      </div>
                      <Separator />
                      <div className="space-y-3">
                        <div className="text-sm font-medium">
                          {t("settings.composer.codeFences.title")}
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                            <div className="space-y-1">
                              <Label htmlFor="composer-fence-space">
                                {t("settings.composer.codeFences.expandSpace.title")}
                              </Label>
                              <div className="text-sm text-muted-foreground">
                                {t("settings.composer.codeFences.expandSpace.subtitle")}
                              </div>
                            </div>
                            <Switch
                              id="composer-fence-space"
                              checked={appSettings.composerFenceExpandOnSpace}
                              onCheckedChange={(value) =>
                                void onUpdateAppSettings({
                                  ...appSettings,
                                  composerFenceExpandOnSpace: value,
                                })
                              }
                            />
                          </div>
                          <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                            <div className="space-y-1">
                              <Label htmlFor="composer-fence-enter">
                                {t("settings.composer.codeFences.expandEnter.title")}
                              </Label>
                              <div className="text-sm text-muted-foreground">
                                {t("settings.composer.codeFences.expandEnter.subtitle")}
                              </div>
                            </div>
                            <Switch
                              id="composer-fence-enter"
                              checked={appSettings.composerFenceExpandOnEnter}
                              onCheckedChange={(value) =>
                                void onUpdateAppSettings({
                                  ...appSettings,
                                  composerFenceExpandOnEnter: value,
                                })
                              }
                            />
                          </div>
                          <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                            <div className="space-y-1">
                              <Label htmlFor="composer-fence-language">
                                {t("settings.composer.codeFences.languageTags.title")}
                              </Label>
                              <div className="text-sm text-muted-foreground">
                                {t("settings.composer.codeFences.languageTags.subtitle")}
                              </div>
                            </div>
                            <Switch
                              id="composer-fence-language"
                              checked={appSettings.composerFenceLanguageTags}
                              onCheckedChange={(value) =>
                                void onUpdateAppSettings({
                                  ...appSettings,
                                  composerFenceLanguageTags: value,
                                })
                              }
                            />
                          </div>
                          <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                            <div className="space-y-1">
                              <Label htmlFor="composer-fence-wrap">
                                {t("settings.composer.codeFences.wrapSelection.title")}
                              </Label>
                              <div className="text-sm text-muted-foreground">
                                {t("settings.composer.codeFences.wrapSelection.subtitle")}
                              </div>
                            </div>
                            <Switch
                              id="composer-fence-wrap"
                              checked={appSettings.composerFenceWrapSelection}
                              onCheckedChange={(value) =>
                                void onUpdateAppSettings({
                                  ...appSettings,
                                  composerFenceWrapSelection: value,
                                })
                              }
                            />
                          </div>
                          <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                            <div className="space-y-1">
                              <Label htmlFor="composer-fence-copy">
                                {t("settings.composer.codeFences.copyWithoutFences.title")}
                              </Label>
                              <div className="text-sm text-muted-foreground">
                                {t("settings.composer.codeFences.copyWithoutFences.subtitle")}
                              </div>
                            </div>
                            <Switch
                              id="composer-fence-copy"
                              checked={appSettings.composerCodeBlockCopyUseModifier}
                              onCheckedChange={(value) =>
                                void onUpdateAppSettings({
                                  ...appSettings,
                                  composerCodeBlockCopyUseModifier: value,
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>
                      <Separator />
                      <div className="space-y-3">
                        <div className="text-sm font-medium">
                          {t("settings.composer.pasting.title")}
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                            <div className="space-y-1">
                              <Label htmlFor="composer-paste-multiline">
                                {t("settings.composer.pasting.autoWrapMultiline.title")}
                              </Label>
                              <div className="text-sm text-muted-foreground">
                                {t("settings.composer.pasting.autoWrapMultiline.subtitle")}
                              </div>
                            </div>
                            <Switch
                              id="composer-paste-multiline"
                              checked={appSettings.composerFenceAutoWrapPasteMultiline}
                              onCheckedChange={(value) =>
                                void onUpdateAppSettings({
                                  ...appSettings,
                                  composerFenceAutoWrapPasteMultiline: value,
                                })
                              }
                            />
                          </div>
                          <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                            <div className="space-y-1">
                              <Label htmlFor="composer-paste-codelike">
                                {t("settings.composer.pasting.autoWrapCodeLike.title")}
                              </Label>
                              <div className="text-sm text-muted-foreground">
                                {t("settings.composer.pasting.autoWrapCodeLike.subtitle")}
                              </div>
                            </div>
                            <Switch
                              id="composer-paste-codelike"
                              checked={appSettings.composerFenceAutoWrapPasteCodeLike}
                              onCheckedChange={(value) =>
                                void onUpdateAppSettings({
                                  ...appSettings,
                                  composerFenceAutoWrapPasteCodeLike: value,
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>
                      <Separator />
                      <div className="space-y-3">
                        <div className="text-sm font-medium">
                          {t("settings.composer.lists.title")}
                        </div>
                        <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                          <div className="space-y-1">
                            <Label htmlFor="composer-list-continuation">
                              {t("settings.composer.lists.continue.title")}
                            </Label>
                            <div className="text-sm text-muted-foreground">
                              {t("settings.composer.lists.continue.subtitle")}
                            </div>
                          </div>
                          <Switch
                            id="composer-list-continuation"
                            checked={appSettings.composerListContinuation}
                            onCheckedChange={(value) =>
                              void onUpdateAppSettings({
                                ...appSettings,
                                composerListContinuation: value,
                              })
                            }
                          />
                        </div>
                      </div>
                    </SettingsSection>
                  </div>
                </TabsContent>
                <TabsContent value="dictation" className="mt-0">
                  <div className="space-y-4">
                    <SettingsSection
                      title={t("settings.dictation.title")}
                      description={t("settings.dictation.subtitle")}
                    >
                      <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                        <div className="space-y-1">
                          <Label htmlFor="dictation-enabled">
                            {t("settings.dictation.enable.title")}
                          </Label>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.dictation.enable.subtitle")}
                          </div>
                        </div>
                        <Switch
                          id="dictation-enabled"
                          checked={appSettings.dictationEnabled}
                          onCheckedChange={(value) => {
                            const nextEnabled = value;
                            void onUpdateAppSettings({
                              ...appSettings,
                              dictationEnabled: nextEnabled,
                            });
                            if (
                              !nextEnabled &&
                              dictationModelStatus?.state === "downloading" &&
                              onCancelDictationDownload
                            ) {
                              onCancelDictationDownload();
                            }
                            if (
                              nextEnabled &&
                              dictationModelStatus?.state === "missing" &&
                              onDownloadDictationModel
                            ) {
                              onDownloadDictationModel();
                            }
                          }}
                        />
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="dictation-model">
                            {t("settings.dictation.model.label")}
                          </Label>
                          <Select
                            value={appSettings.dictationModelId}
                            onValueChange={(value) =>
                              void onUpdateAppSettings({
                                ...appSettings,
                                dictationModelId: value,
                              })
                            }
                          >
                            <SelectTrigger id="dictation-model">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {dictationModels.map((model) => (
                                <SelectItem key={model.id} value={model.id}>
                                  {model.label} ({model.size})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.dictation.modelHelp", {
                              note: selectedDictationModel.note,
                              size: selectedDictationModel.size,
                            })}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dictation-language">
                            {t("settings.dictation.language.label")}
                          </Label>
                          <Select
                            value={appSettings.dictationPreferredLanguage ?? DICTATION_AUTO_VALUE}
                            onValueChange={(value) =>
                              void onUpdateAppSettings({
                                ...appSettings,
                                dictationPreferredLanguage:
                                  value === DICTATION_AUTO_VALUE ? null : value,
                              })
                            }
                          >
                            <SelectTrigger id="dictation-language">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={DICTATION_AUTO_VALUE}>
                                {t("settings.dictation.language.auto")}
                              </SelectItem>
                              <SelectItem value="en">
                                {t("settings.dictation.language.en")}
                              </SelectItem>
                              <SelectItem value="es">
                                {t("settings.dictation.language.es")}
                              </SelectItem>
                              <SelectItem value="fr">
                                {t("settings.dictation.language.fr")}
                              </SelectItem>
                              <SelectItem value="de">
                                {t("settings.dictation.language.de")}
                              </SelectItem>
                              <SelectItem value="it">
                                {t("settings.dictation.language.it")}
                              </SelectItem>
                              <SelectItem value="pt">
                                {t("settings.dictation.language.pt")}
                              </SelectItem>
                              <SelectItem value="nl">
                                {t("settings.dictation.language.nl")}
                              </SelectItem>
                              <SelectItem value="sv">
                                {t("settings.dictation.language.sv")}
                              </SelectItem>
                              <SelectItem value="no">
                                {t("settings.dictation.language.no")}
                              </SelectItem>
                              <SelectItem value="da">
                                {t("settings.dictation.language.da")}
                              </SelectItem>
                              <SelectItem value="fi">
                                {t("settings.dictation.language.fi")}
                              </SelectItem>
                              <SelectItem value="pl">
                                {t("settings.dictation.language.pl")}
                              </SelectItem>
                              <SelectItem value="tr">
                                {t("settings.dictation.language.tr")}
                              </SelectItem>
                              <SelectItem value="ru">
                                {t("settings.dictation.language.ru")}
                              </SelectItem>
                              <SelectItem value="uk">
                                {t("settings.dictation.language.uk")}
                              </SelectItem>
                              <SelectItem value="ja">
                                {t("settings.dictation.language.ja")}
                              </SelectItem>
                              <SelectItem value="ko">
                                {t("settings.dictation.language.ko")}
                              </SelectItem>
                              <SelectItem value="zh">
                                {t("settings.dictation.language.zh")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.dictation.language.help")}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dictation-hold-key">
                            {t("settings.dictation.holdKey.label")}
                          </Label>
                          <Select
                            value={appSettings.dictationHoldKey ?? DICTATION_HOLD_OFF_VALUE}
                            onValueChange={(value) =>
                              void onUpdateAppSettings({
                                ...appSettings,
                                dictationHoldKey:
                                  value === DICTATION_HOLD_OFF_VALUE ? null : value,
                              })
                            }
                          >
                            <SelectTrigger id="dictation-hold-key">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={DICTATION_HOLD_OFF_VALUE}>
                                {t("settings.dictation.holdKey.off")}
                              </SelectItem>
                              <SelectItem value="alt">
                                {t("settings.dictation.holdKey.alt")}
                              </SelectItem>
                              <SelectItem value="shift">
                                {t("settings.dictation.holdKey.shift")}
                              </SelectItem>
                              <SelectItem value="control">
                                {t("settings.dictation.holdKey.control")}
                              </SelectItem>
                              <SelectItem value="meta">
                                {t("settings.dictation.holdKey.meta")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.dictation.holdKey.help")}
                          </div>
                        </div>
                      </div>
                      {dictationModelStatus && (
                        <div className="space-y-2 rounded-md border border-border/60 p-3">
                          <div className="text-sm font-medium">
                            {t("settings.dictation.status.label", {
                              label: selectedDictationModel.label,
                            })}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {dictationModelStatus.state === "ready" &&
                              t("settings.dictation.status.ready")}
                            {dictationModelStatus.state === "missing" &&
                              t("settings.dictation.status.missing")}
                            {dictationModelStatus.state === "downloading" &&
                              t("settings.dictation.status.downloading")}
                            {dictationModelStatus.state === "error" &&
                              (dictationModelStatus.error ??
                                t("settings.dictation.status.error"))}
                          </div>
                          {dictationProgress && (
                            <div className="space-y-1">
                              <div className="h-2 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full bg-primary"
                                  style={{
                                    width: dictationProgress.totalBytes
                                      ? `${Math.min(
                                          100,
                                          (dictationProgress.downloadedBytes /
                                            dictationProgress.totalBytes) *
                                            100,
                                        )}%`
                                      : "0%",
                                  }}
                                />
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatDownloadSize(dictationProgress.downloadedBytes)}
                              </div>
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2">
                            {dictationModelStatus.state === "missing" && (
                              <Button
                                type="button"
                                onClick={onDownloadDictationModel}
                                disabled={!onDownloadDictationModel}
                              >
                                {t("settings.action.downloadModel")}
                              </Button>
                            )}
                            {dictationModelStatus.state === "downloading" && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={onCancelDictationDownload}
                                disabled={!onCancelDictationDownload}
                              >
                                {t("settings.action.cancelDownload")}
                              </Button>
                            )}
                            {dictationReady && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={onRemoveDictationModel}
                                disabled={!onRemoveDictationModel}
                              >
                                {t("settings.action.removeModel")}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </SettingsSection>
                  </div>
                </TabsContent>
                <TabsContent value="shortcuts" className="mt-0">
                  <div className="space-y-4">
                    <SettingsSection
                      title={t("settings.shortcuts.title")}
                      description={t("settings.shortcuts.subtitle")}
                    >
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {t("settings.shortcuts.file.title")}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.shortcuts.file.subtitle")}
                          </div>
                        </div>
                        <div className="grid gap-4">
                          <div className="space-y-2">
                            <Label>{t("settings.shortcuts.newAgent")}</Label>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                className="w-56"
                                value={formatShortcut(shortcutDrafts.newAgent)}
                                onKeyDown={(event) =>
                                  handleShortcutKeyDown(event, "newAgentShortcut")
                                }
                                placeholder={t("settings.shortcuts.placeholder")}
                                readOnly
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => void updateShortcut("newAgentShortcut", null)}
                              >
                                {t("settings.action.clear")}
                              </Button>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t("settings.shortcuts.default", {
                                value: formatShortcut("cmd+n"),
                              })}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>{t("settings.shortcuts.newWorktreeAgent")}</Label>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                className="w-56"
                                value={formatShortcut(shortcutDrafts.newWorktreeAgent)}
                                onKeyDown={(event) =>
                                  handleShortcutKeyDown(event, "newWorktreeAgentShortcut")
                                }
                                placeholder={t("settings.shortcuts.placeholder")}
                                readOnly
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  void updateShortcut("newWorktreeAgentShortcut", null)
                                }
                              >
                                {t("settings.action.clear")}
                              </Button>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t("settings.shortcuts.default", {
                                value: formatShortcut("cmd+shift+n"),
                              })}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>{t("settings.shortcuts.newCloneAgent")}</Label>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                className="w-56"
                                value={formatShortcut(shortcutDrafts.newCloneAgent)}
                                onKeyDown={(event) =>
                                  handleShortcutKeyDown(event, "newCloneAgentShortcut")
                                }
                                placeholder={t("settings.shortcuts.placeholder")}
                                readOnly
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  void updateShortcut("newCloneAgentShortcut", null)
                                }
                              >
                                {t("settings.action.clear")}
                              </Button>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t("settings.shortcuts.default", {
                                value: formatShortcut("cmd+alt+n"),
                              })}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>{t("settings.shortcuts.archiveThread")}</Label>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                className="w-56"
                                value={formatShortcut(shortcutDrafts.archiveThread)}
                                onKeyDown={(event) =>
                                  handleShortcutKeyDown(event, "archiveThreadShortcut")
                                }
                                placeholder={t("settings.shortcuts.placeholder")}
                                readOnly
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  void updateShortcut("archiveThreadShortcut", null)
                                }
                              >
                                {t("settings.action.clear")}
                              </Button>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t("settings.shortcuts.default", {
                                value: formatShortcut("cmd+ctrl+a"),
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                      <Separator />
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {t("settings.shortcuts.composer.title")}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.shortcuts.composer.subtitle")}
                          </div>
                        </div>
                        <div className="grid gap-4">
                          <div className="space-y-2">
                            <Label>{t("settings.shortcuts.cycleModel")}</Label>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                className="w-56"
                                value={formatShortcut(shortcutDrafts.model)}
                                onKeyDown={(event) =>
                                  handleShortcutKeyDown(event, "composerModelShortcut")
                                }
                                placeholder={t("settings.shortcuts.placeholder")}
                                readOnly
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  void updateShortcut("composerModelShortcut", null)
                                }
                              >
                                {t("settings.action.clear")}
                              </Button>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t("settings.shortcuts.pressToSet", {
                                value: formatShortcut("cmd+shift+m"),
                              })}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>{t("settings.shortcuts.cycleAccess")}</Label>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                className="w-56"
                                value={formatShortcut(shortcutDrafts.access)}
                                onKeyDown={(event) =>
                                  handleShortcutKeyDown(event, "composerAccessShortcut")
                                }
                                placeholder={t("settings.shortcuts.placeholder")}
                                readOnly
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  void updateShortcut("composerAccessShortcut", null)
                                }
                              >
                                {t("settings.action.clear")}
                              </Button>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t("settings.shortcuts.default", {
                                value: formatShortcut("cmd+shift+a"),
                              })}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>{t("settings.shortcuts.cycleReasoning")}</Label>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                className="w-56"
                                value={formatShortcut(shortcutDrafts.reasoning)}
                                onKeyDown={(event) =>
                                  handleShortcutKeyDown(event, "composerReasoningShortcut")
                                }
                                placeholder={t("settings.shortcuts.placeholder")}
                                readOnly
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  void updateShortcut("composerReasoningShortcut", null)
                                }
                              >
                                {t("settings.action.clear")}
                              </Button>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t("settings.shortcuts.default", {
                                value: formatShortcut("cmd+shift+r"),
                              })}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>{t("settings.shortcuts.cycleCollaboration")}</Label>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                className="w-56"
                                value={formatShortcut(shortcutDrafts.collaboration)}
                                onKeyDown={(event) =>
                                  handleShortcutKeyDown(event, "composerCollaborationShortcut")
                                }
                                placeholder={t("settings.shortcuts.placeholder")}
                                readOnly
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  void updateShortcut("composerCollaborationShortcut", null)
                                }
                              >
                                {t("settings.action.clear")}
                              </Button>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t("settings.shortcuts.default", {
                                value: formatShortcut("shift+tab"),
                              })}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>{t("settings.shortcuts.stopRun")}</Label>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                className="w-56"
                                value={formatShortcut(shortcutDrafts.interrupt)}
                                onKeyDown={(event) =>
                                  handleShortcutKeyDown(event, "interruptShortcut")
                                }
                                placeholder={t("settings.shortcuts.placeholder")}
                                readOnly
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  void updateShortcut("interruptShortcut", null)
                                }
                              >
                                {t("settings.action.clear")}
                              </Button>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t("settings.shortcuts.default", {
                                value: formatShortcut(getDefaultInterruptShortcut()),
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                      <Separator />
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {t("settings.shortcuts.panels.title")}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.shortcuts.panels.subtitle")}
                          </div>
                        </div>
                        <div className="grid gap-4">
                          <div className="space-y-2">
                            <Label>{t("settings.shortcuts.panels.projects")}</Label>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                className="w-56"
                                value={formatShortcut(shortcutDrafts.projectsSidebar)}
                                onKeyDown={(event) =>
                                  handleShortcutKeyDown(
                                    event,
                                    "toggleProjectsSidebarShortcut",
                                  )
                                }
                                placeholder={t("settings.shortcuts.placeholder")}
                                readOnly
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  void updateShortcut(
                                    "toggleProjectsSidebarShortcut",
                                    null,
                                  )
                                }
                              >
                                {t("settings.action.clear")}
                              </Button>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t("settings.shortcuts.default", {
                                value: formatShortcut("cmd+shift+p"),
                              })}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>{t("settings.shortcuts.panels.git")}</Label>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                className="w-56"
                                value={formatShortcut(shortcutDrafts.gitSidebar)}
                                onKeyDown={(event) =>
                                  handleShortcutKeyDown(
                                    event,
                                    "toggleGitSidebarShortcut",
                                  )
                                }
                                placeholder={t("settings.shortcuts.placeholder")}
                                readOnly
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  void updateShortcut("toggleGitSidebarShortcut", null)
                                }
                              >
                                {t("settings.action.clear")}
                              </Button>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t("settings.shortcuts.default", {
                                value: formatShortcut("cmd+shift+g"),
                              })}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>{t("settings.shortcuts.panels.debug")}</Label>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                className="w-56"
                                value={formatShortcut(shortcutDrafts.debugPanel)}
                                onKeyDown={(event) =>
                                  handleShortcutKeyDown(
                                    event,
                                    "toggleDebugPanelShortcut",
                                  )
                                }
                                placeholder={t("settings.shortcuts.placeholder")}
                                readOnly
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  void updateShortcut("toggleDebugPanelShortcut", null)
                                }
                              >
                                {t("settings.action.clear")}
                              </Button>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t("settings.shortcuts.default", {
                                value: formatShortcut("cmd+shift+d"),
                              })}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>{t("settings.shortcuts.panels.terminal")}</Label>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                className="w-56"
                                value={formatShortcut(shortcutDrafts.terminal)}
                                onKeyDown={(event) =>
                                  handleShortcutKeyDown(
                                    event,
                                    "toggleTerminalShortcut",
                                  )
                                }
                                placeholder={t("settings.shortcuts.placeholder")}
                                readOnly
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  void updateShortcut("toggleTerminalShortcut", null)
                                }
                              >
                                {t("settings.action.clear")}
                              </Button>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t("settings.shortcuts.default", {
                                value: formatShortcut("cmd+shift+t"),
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                      <Separator />
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {t("settings.shortcuts.navigation.title")}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.shortcuts.navigation.subtitle")}
                          </div>
                        </div>
                        <div className="grid gap-4">
                          <div className="space-y-2">
                            <Label>{t("settings.shortcuts.navigation.nextAgent")}</Label>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                className="w-56"
                                value={formatShortcut(shortcutDrafts.cycleAgentNext)}
                                onKeyDown={(event) =>
                                  handleShortcutKeyDown(event, "cycleAgentNextShortcut")
                                }
                                placeholder={t("settings.shortcuts.placeholder")}
                                readOnly
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  void updateShortcut("cycleAgentNextShortcut", null)
                                }
                              >
                                {t("settings.action.clear")}
                              </Button>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t("settings.shortcuts.default", {
                                value: formatShortcut("cmd+ctrl+down"),
                              })}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>{t("settings.shortcuts.navigation.prevAgent")}</Label>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                className="w-56"
                                value={formatShortcut(shortcutDrafts.cycleAgentPrev)}
                                onKeyDown={(event) =>
                                  handleShortcutKeyDown(event, "cycleAgentPrevShortcut")
                                }
                                placeholder={t("settings.shortcuts.placeholder")}
                                readOnly
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  void updateShortcut("cycleAgentPrevShortcut", null)
                                }
                              >
                                {t("settings.action.clear")}
                              </Button>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t("settings.shortcuts.default", {
                                value: formatShortcut("cmd+ctrl+up"),
                              })}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>{t("settings.shortcuts.navigation.nextWorkspace")}</Label>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                className="w-56"
                                value={formatShortcut(shortcutDrafts.cycleWorkspaceNext)}
                                onKeyDown={(event) =>
                                  handleShortcutKeyDown(
                                    event,
                                    "cycleWorkspaceNextShortcut",
                                  )
                                }
                                placeholder={t("settings.shortcuts.placeholder")}
                                readOnly
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  void updateShortcut("cycleWorkspaceNextShortcut", null)
                                }
                              >
                                {t("settings.action.clear")}
                              </Button>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t("settings.shortcuts.default", {
                                value: formatShortcut("cmd+shift+down"),
                              })}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>{t("settings.shortcuts.navigation.prevWorkspace")}</Label>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                className="w-56"
                                value={formatShortcut(shortcutDrafts.cycleWorkspacePrev)}
                                onKeyDown={(event) =>
                                  handleShortcutKeyDown(
                                    event,
                                    "cycleWorkspacePrevShortcut",
                                  )
                                }
                                placeholder={t("settings.shortcuts.placeholder")}
                                readOnly
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() =>
                                  void updateShortcut("cycleWorkspacePrevShortcut", null)
                                }
                              >
                                {t("settings.action.clear")}
                              </Button>
                            </div>
                          <div className="text-xs text-muted-foreground">
                            {t("settings.shortcuts.default", {
                              value: formatShortcut("cmd+shift+up"),
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                    </SettingsSection>
                  </div>
                </TabsContent>
                <TabsContent value="open-apps" className="mt-0">
                  <div className="space-y-4">
                    <SettingsSection
                      title={t("settings.openApps.title")}
                      description={t("settings.openApps.subtitle")}
                    >
                      <div className="space-y-3">
                        {openAppDrafts.map((target, index) => {
                          const iconSrc =
                            getKnownOpenAppIcon(target.id) ??
                            openAppIconById[target.id] ??
                            GENERIC_APP_ICON;
                          return (
                            <div key={target.id} className="rounded-md border border-border/60 p-3">
                              <div className="flex flex-wrap items-start gap-3">
                                <div
                                  className="flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-muted/20"
                                  aria-hidden
                                >
                                  <img src={iconSrc} alt="" width={18} height={18} />
                                </div>
                                <div className="flex-1 space-y-3">
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-2">
                                      <Label htmlFor={`open-app-label-${target.id}`}>
                                        {t("settings.openApps.label")}
                                      </Label>
                                      <Input
                                        id={`open-app-label-${target.id}`}
                                        value={target.label}
                                        placeholder={t("settings.openApps.label")}
                                        onChange={(event) =>
                                          handleOpenAppDraftChange(index, {
                                            label: event.target.value,
                                          })
                                        }
                                        onBlur={() => {
                                          void handleCommitOpenApps(openAppDrafts);
                                        }}
                                        aria-label={t("settings.openApps.aria.label", {
                                          index: index + 1,
                                        })}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor={`open-app-kind-${target.id}`}>
                                        {t("settings.openApps.type")}
                                      </Label>
                                      <Select
                                        value={target.kind}
                                        onValueChange={(value) =>
                                          handleOpenAppKindChange(
                                            index,
                                            value as OpenAppTarget["kind"],
                                          )
                                        }
                                      >
                                        <SelectTrigger id={`open-app-kind-${target.id}`}>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="app">
                                            {t("settings.openApps.type.app")}
                                          </SelectItem>
                                          <SelectItem value="command">
                                            {t("settings.openApps.type.command")}
                                          </SelectItem>
                                          <SelectItem value="finder">{fileManagerLabel}</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    {target.kind === "app" && (
                                      <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor={`open-app-appname-${target.id}`}>
                                          {t("settings.openApps.appName")}
                                        </Label>
                                        <Input
                                          id={`open-app-appname-${target.id}`}
                                          value={target.appName ?? ""}
                                          placeholder={t("settings.openApps.appName")}
                                          onChange={(event) =>
                                            handleOpenAppDraftChange(index, {
                                              appName: event.target.value,
                                            })
                                          }
                                          onBlur={() => {
                                            void handleCommitOpenApps(openAppDrafts);
                                          }}
                                          aria-label={t("settings.openApps.aria.appName", {
                                            index: index + 1,
                                          })}
                                        />
                                      </div>
                                    )}
                                    {target.kind === "command" && (
                                      <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor={`open-app-command-${target.id}`}>
                                          {t("settings.openApps.command")}
                                        </Label>
                                        <Input
                                          id={`open-app-command-${target.id}`}
                                          value={target.command ?? ""}
                                          placeholder={t("settings.openApps.command")}
                                          onChange={(event) =>
                                            handleOpenAppDraftChange(index, {
                                              command: event.target.value,
                                            })
                                          }
                                          onBlur={() => {
                                            void handleCommitOpenApps(openAppDrafts);
                                          }}
                                          aria-label={t("settings.openApps.aria.command", {
                                            index: index + 1,
                                          })}
                                        />
                                      </div>
                                    )}
                                    {target.kind !== "finder" && (
                                      <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor={`open-app-args-${target.id}`}>
                                          {t("settings.openApps.args")}
                                        </Label>
                                        <Input
                                          id={`open-app-args-${target.id}`}
                                          value={target.argsText}
                                          placeholder={t("settings.openApps.args")}
                                          onChange={(event) =>
                                            handleOpenAppDraftChange(index, {
                                              argsText: event.target.value,
                                            })
                                          }
                                          onBlur={() => {
                                            void handleCommitOpenApps(openAppDrafts);
                                          }}
                                          aria-label={t("settings.openApps.aria.args", {
                                            index: index + 1,
                                          })}
                                        />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <label className="flex items-center gap-2 text-sm">
                                      <input
                                        type="radio"
                                        className="h-4 w-4"
                                        name="open-app-default"
                                        checked={target.id === openAppSelectedId}
                                        onChange={() => handleSelectOpenAppDefault(target.id)}
                                      />
                                      {t("settings.openApps.default")}
                                    </label>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="text-muted-foreground hover:text-foreground"
                                        onClick={() => handleMoveOpenApp(index, "up")}
                                        disabled={index === 0}
                                        aria-label={t("settings.openApps.moveUp")}
                                      >
                                        <ChevronUp className="h-4 w-4" aria-hidden />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="text-muted-foreground hover:text-foreground"
                                        onClick={() => handleMoveOpenApp(index, "down")}
                                        disabled={index === openAppDrafts.length - 1}
                                        aria-label={t("settings.openApps.moveDown")}
                                      >
                                        <ChevronDown className="h-4 w-4" aria-hidden />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="text-muted-foreground hover:text-foreground"
                                        onClick={() => handleDeleteOpenApp(index)}
                                        disabled={openAppDrafts.length <= 1}
                                        aria-label={t("settings.openApps.remove")}
                                        title={t("settings.openApps.remove")}
                                      >
                                        <Trash2 className="h-4 w-4" aria-hidden />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <Button type="button" variant="outline" onClick={handleAddOpenApp}>
                          {t("settings.action.addApp")}
                        </Button>
                        <div className="text-sm text-muted-foreground">
                          {t("settings.openApps.help")}
                        </div>
                      </div>
                    </SettingsSection>
                  </div>
                </TabsContent>
                <TabsContent value="codex" className="mt-0">
                  <div className="space-y-4">
                    <SettingsSection
                      title={t("settings.codex.title")}
                      description={t("settings.codex.subtitle")}
                    >
                      <div className="space-y-2">
                        <Label htmlFor="codex-path">{t("settings.codex.path.label")}</Label>
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            id="codex-path"
                            value={codexPathDraft}
                            placeholder="codex"
                            onChange={(event) => setCodexPathDraft(event.target.value)}
                          />
                          <Button type="button" variant="outline" onClick={handleBrowseCodex}>
                            {t("settings.action.browse")}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setCodexPathDraft("")}
                          >
                            {t("settings.action.usePath")}
                          </Button>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {t("settings.codex.path.help")}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="codex-args">{t("settings.codex.args.label")}</Label>
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            id="codex-args"
                            value={codexArgsDraft}
                            placeholder="--profile personal"
                            onChange={(event) => setCodexArgsDraft(event.target.value)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setCodexArgsDraft("")}
                          >
                            {t("settings.action.clear")}
                          </Button>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {t("settings.codex.args.help")}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {codexDirty && (
                          <Button
                            type="button"
                            onClick={handleSaveCodexSettings}
                            disabled={isSavingSettings}
                          >
                            {isSavingSettings
                              ? t("settings.action.saving")
                              : t("settings.action.save")}
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleRunDoctor}
                          disabled={doctorState.status === "running"}
                        >
                          <Stethoscope className="h-4 w-4" aria-hidden />
                          {doctorState.status === "running"
                            ? t("settings.action.running")
                            : t("settings.action.runDoctor")}
                        </Button>
                      </div>
                      {doctorState.result && (
                        <div
                          className={cn(
                            "rounded-md border border-border/60 p-3 text-sm",
                            doctorState.result.ok
                              ? "border-emerald-500/40 bg-emerald-50/40"
                              : "border-destructive/40 bg-destructive/10",
                          )}
                        >
                          <div className="font-medium">
                            {doctorState.result.ok
                              ? t("settings.codex.doctor.okTitle")
                              : t("settings.codex.doctor.errorTitle")}
                          </div>
                          <div className="mt-2 space-y-1 text-sm">
                            <div>
                              {t("settings.codex.doctor.version", {
                                value:
                                  doctorState.result.version ??
                                  t("settings.codex.doctor.unknown"),
                              })}
                            </div>
                            <div>
                              {t("settings.codex.doctor.appServer", {
                                value: doctorState.result.appServerOk
                                  ? t("settings.codex.doctor.ok")
                                  : t("settings.codex.doctor.failed"),
                              })}
                            </div>
                            <div>
                              {t("settings.codex.doctor.node", {
                                value: doctorState.result.nodeOk
                                  ? t("settings.codex.doctor.okWithVersion", {
                                      version:
                                        doctorState.result.nodeVersion ??
                                        t("settings.codex.doctor.unknown"),
                                    })
                                  : t("settings.codex.doctor.missing"),
                              })}
                            </div>
                            {doctorState.result.details && (
                              <div>{doctorState.result.details}</div>
                            )}
                            {doctorState.result.nodeDetails && (
                              <div>{doctorState.result.nodeDetails}</div>
                            )}
                            {doctorState.result.path && (
                              <div className="text-xs text-muted-foreground">
                                {t("settings.codex.doctor.path", {
                                  value: doctorState.result.path,
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </SettingsSection>
                    <SettingsSection
                      title={t("settings.codex.workspaceOverrides.title")}
                      description={t("settings.codex.workspaceOverrides.subtitle")}
                    >
                      <div className="space-y-3">
                        {projects.map((workspace) => (
                          <div key={workspace.id} className="rounded-md border border-border/60 p-3">
                            <div className="space-y-3">
                              <div>
                                <div className="text-sm font-medium">{workspace.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {workspace.path}
                                </div>
                              </div>
                              <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                  <Label htmlFor={`override-bin-${workspace.id}`}>
                                    {t("settings.codex.workspaceOverrides.binLabel")}
                                  </Label>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      id={`override-bin-${workspace.id}`}
                                      value={codexBinOverrideDrafts[workspace.id] ?? ""}
                                      placeholder={t(
                                        "settings.codex.workspaceOverrides.binPlaceholder",
                                      )}
                                      onChange={(event) =>
                                        setCodexBinOverrideDrafts((prev) => ({
                                          ...prev,
                                          [workspace.id]: event.target.value,
                                        }))
                                      }
                                      onBlur={async () => {
                                        const draft = codexBinOverrideDrafts[workspace.id] ?? "";
                                        const nextValue = normalizeOverrideValue(draft);
                                        if (nextValue === (workspace.codex_bin ?? null)) {
                                          return;
                                        }
                                        await onUpdateWorkspaceCodexBin(workspace.id, nextValue);
                                      }}
                                      aria-label={t(
                                        "settings.codex.workspaceOverrides.binAria",
                                        { name: workspace.name },
                                      )}
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={async () => {
                                        setCodexBinOverrideDrafts((prev) => ({
                                          ...prev,
                                          [workspace.id]: "",
                                        }));
                                        await onUpdateWorkspaceCodexBin(workspace.id, null);
                                      }}
                                    >
                                      {t("settings.action.clear")}
                                    </Button>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`override-home-${workspace.id}`}>
                                    {t("settings.codex.workspaceOverrides.homeLabel")}
                                  </Label>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      id={`override-home-${workspace.id}`}
                                      value={codexHomeOverrideDrafts[workspace.id] ?? ""}
                                      placeholder={t(
                                        "settings.codex.workspaceOverrides.homePlaceholder",
                                      )}
                                      onChange={(event) =>
                                        setCodexHomeOverrideDrafts((prev) => ({
                                          ...prev,
                                          [workspace.id]: event.target.value,
                                        }))
                                      }
                                      onBlur={async () => {
                                        const draft = codexHomeOverrideDrafts[workspace.id] ?? "";
                                        const nextValue = normalizeOverrideValue(draft);
                                        if (nextValue === (workspace.settings.codexHome ?? null)) {
                                          return;
                                        }
                                        await onUpdateWorkspaceSettings(workspace.id, {
                                          codexHome: nextValue,
                                        });
                                      }}
                                      aria-label={t(
                                        "settings.codex.workspaceOverrides.homeAria",
                                        { name: workspace.name },
                                      )}
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={async () => {
                                        setCodexHomeOverrideDrafts((prev) => ({
                                          ...prev,
                                          [workspace.id]: "",
                                        }));
                                        await onUpdateWorkspaceSettings(workspace.id, {
                                          codexHome: null,
                                        });
                                      }}
                                    >
                                      {t("settings.action.clear")}
                                    </Button>
                                  </div>
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                  <Label htmlFor={`override-args-${workspace.id}`}>
                                    {t("settings.codex.workspaceOverrides.argsLabel")}
                                  </Label>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      id={`override-args-${workspace.id}`}
                                      value={codexArgsOverrideDrafts[workspace.id] ?? ""}
                                      placeholder={t(
                                        "settings.codex.workspaceOverrides.argsPlaceholder",
                                      )}
                                      onChange={(event) =>
                                        setCodexArgsOverrideDrafts((prev) => ({
                                          ...prev,
                                          [workspace.id]: event.target.value,
                                        }))
                                      }
                                      onBlur={async () => {
                                        const draft = codexArgsOverrideDrafts[workspace.id] ?? "";
                                        const nextValue = normalizeOverrideValue(draft);
                                        if (nextValue === (workspace.settings.codexArgs ?? null)) {
                                          return;
                                        }
                                        await onUpdateWorkspaceSettings(workspace.id, {
                                          codexArgs: nextValue,
                                        });
                                      }}
                                      aria-label={t(
                                        "settings.codex.workspaceOverrides.argsAria",
                                        { name: workspace.name },
                                      )}
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={async () => {
                                        setCodexArgsOverrideDrafts((prev) => ({
                                          ...prev,
                                          [workspace.id]: "",
                                        }));
                                        await onUpdateWorkspaceSettings(workspace.id, {
                                          codexArgs: null,
                                        });
                                      }}
                                    >
                                      {t("settings.action.clear")}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {projects.length === 0 && (
                          <div className="text-sm text-muted-foreground">
                            {t("settings.projects.project.empty")}
                          </div>
                        )}
                      </div>
                    </SettingsSection>
                    <SettingsSection
                      title={t("settings.codex.access.title")}
                      description={t("settings.codex.access.subtitle")}
                    >
                      <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="default-access">
                            {t("settings.codex.defaultAccess")}
                          </Label>
                          <Select
                            value={appSettings.defaultAccessMode}
                            onValueChange={(value) =>
                              void onUpdateAppSettings({
                                ...appSettings,
                                defaultAccessMode: value as AppSettings["defaultAccessMode"],
                              })
                            }
                          >
                            <SelectTrigger id="default-access">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="read-only">
                                {t("settings.codex.access.readOnly")}
                              </SelectItem>
                              <SelectItem value="current">
                                {t("settings.codex.access.onRequest")}
                              </SelectItem>
                              <SelectItem value="full-access">
                                {t("settings.codex.access.full")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="backend-mode">
                            {t("settings.codex.backendMode")}
                          </Label>
                          <Select
                            value={appSettings.backendMode}
                            onValueChange={(value) =>
                              void onUpdateAppSettings({
                                ...appSettings,
                                backendMode: value as AppSettings["backendMode"],
                              })
                            }
                          >
                            <SelectTrigger id="backend-mode">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="local">
                                {t("settings.codex.backend.local")}
                              </SelectItem>
                              <SelectItem value="remote">
                                {t("settings.codex.backend.remote")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.codex.backend.help")}
                          </div>
                        </div>
                      </div>
                      {appSettings.backendMode === "remote" && (
                        <div className="space-y-2 rounded-md border border-border/60 p-3">
                          <div className="text-sm font-medium">
                            {t("settings.codex.remote.title")}
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            <Input
                              value={remoteHostDraft}
                              placeholder="127.0.0.1:4732"
                              onChange={(event) => setRemoteHostDraft(event.target.value)}
                              onBlur={() => {
                                void handleCommitRemoteHost();
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void handleCommitRemoteHost();
                                }
                              }}
                              aria-label={t("settings.codex.remote.hostAria")}
                            />
                            <Input
                              type="password"
                              value={remoteTokenDraft}
                              placeholder={t("settings.codex.remote.tokenPlaceholder")}
                              onChange={(event) => setRemoteTokenDraft(event.target.value)}
                              onBlur={() => {
                                void handleCommitRemoteToken();
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void handleCommitRemoteToken();
                                }
                              }}
                              aria-label={t("settings.codex.remote.tokenAria")}
                            />
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.codex.remote.help")}
                          </div>
                        </div>
                      )}
                      </div>
                    </SettingsSection>
                  <div className="space-y-4">
                    <FileEditorCard
                      title={t("settings.codex.fileAgents.title")}
                      meta={globalAgentsMeta}
                      error={globalAgentsError}
                      value={globalAgentsContent}
                      placeholder={t("settings.codex.fileAgents.placeholder")}
                      disabled={globalAgentsLoading}
                      refreshDisabled={globalAgentsRefreshDisabled}
                      saveDisabled={globalAgentsSaveDisabled}
                      saveLabel={globalAgentsSaveLabel}
                      onChange={setGlobalAgentsContent}
                      onRefresh={() => {
                        void refreshGlobalAgents();
                      }}
                      onSave={() => {
                        void saveGlobalAgents();
                      }}
                      helpText={
                        <>
                          {t("settings.codex.fileLocation")} <code>~/.codex/AGENTS.md</code>.
                        </>
                      }
                      classNames={{
                        container: "rounded-md border border-border/60 p-4",
                        header: "flex flex-wrap items-center justify-between gap-2",
                        title: "text-sm font-medium",
                        actions: "flex flex-wrap items-center gap-2",
                        meta: "text-xs text-muted-foreground",
                        iconButton:
                          "inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&_svg]:h-4 [&_svg]:w-4",
                        error: "text-sm text-destructive",
                        textarea:
                          "mt-2 min-h-[160px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm",
                        help: "mt-2 text-xs text-muted-foreground",
                      }}
                    />
                    <FileEditorCard
                      title={t("settings.codex.fileConfig.title")}
                      meta={globalConfigMeta}
                      error={globalConfigError}
                      value={globalConfigContent}
                      placeholder={t("settings.codex.fileConfig.placeholder")}
                      disabled={globalConfigLoading}
                      refreshDisabled={globalConfigRefreshDisabled}
                      saveDisabled={globalConfigSaveDisabled}
                      saveLabel={globalConfigSaveLabel}
                      onChange={setGlobalConfigContent}
                      onRefresh={() => {
                        void refreshGlobalConfig();
                      }}
                      onSave={() => {
                        void saveGlobalConfig();
                      }}
                      helpText={
                        <>
                          {t("settings.codex.fileLocation")} <code>~/.codex/config.toml</code>.
                        </>
                      }
                      classNames={{
                        container: "rounded-md border border-border/60 p-4",
                        header: "flex flex-wrap items-center justify-between gap-2",
                        title: "text-sm font-medium",
                        actions: "flex flex-wrap items-center gap-2",
                        meta: "text-xs text-muted-foreground",
                        iconButton:
                          "inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&_svg]:h-4 [&_svg]:w-4",
                        error: "text-sm text-destructive",
                        textarea:
                          "mt-2 min-h-[160px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm",
                        help: "mt-2 text-xs text-muted-foreground",
                      }}
                    />
                  </div>
                </div>
                </TabsContent>
                <TabsContent value="experimental" className="mt-0">
                  <div className="space-y-4">
                    <SettingsSection
                      title={t("settings.experimental.title")}
                      description={t("settings.experimental.subtitle")}
                    >
                      <div className="space-y-4">
                      {hasCodexHomeOverrides && (
                        <div className="text-sm text-muted-foreground">
                          {t("settings.experimental.overridesNotice")}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-border/60 p-3">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {t("settings.experimental.configFile.title")}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.experimental.configFile.subtitle", {
                              label: fileManagerLabel,
                            })}
                          </div>
                        </div>
                        <Button type="button" variant="outline" onClick={handleOpenConfig}>
                          {openInFileManagerLabel}
                        </Button>
                      </div>
                      {openConfigError && (
                        <div className="text-sm text-destructive">{openConfigError}</div>
                      )}
                      <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                        <div className="space-y-1">
                          <Label htmlFor="experimental-collab">
                            {t("settings.experimental.multiAgent.title")}
                          </Label>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.experimental.multiAgent.subtitle")}
                          </div>
                        </div>
                        <Switch
                          id="experimental-collab"
                          checked={appSettings.experimentalCollabEnabled}
                          onCheckedChange={(value) =>
                            void onUpdateAppSettings({
                              ...appSettings,
                              experimentalCollabEnabled: value,
                            })
                          }
                        />
                      </div>
                      <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                        <div className="space-y-1">
                          <Label htmlFor="experimental-collab-modes">
                            {t("settings.experimental.collaborationModes.title")}
                          </Label>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.experimental.collaborationModes.subtitle")}
                          </div>
                        </div>
                        <Switch
                          id="experimental-collab-modes"
                          checked={appSettings.experimentalCollaborationModesEnabled}
                          onCheckedChange={(value) =>
                            void onUpdateAppSettings({
                              ...appSettings,
                              experimentalCollaborationModesEnabled: value,
                            })
                          }
                        />
                      </div>
                      <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                        <div className="space-y-1">
                          <Label htmlFor="experimental-unified">
                            {t("settings.experimental.backgroundTerminal.title")}
                          </Label>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.experimental.backgroundTerminal.subtitle")}
                          </div>
                        </div>
                        <Switch
                          id="experimental-unified"
                          checked={appSettings.experimentalUnifiedExecEnabled}
                          onCheckedChange={(value) =>
                            void onUpdateAppSettings({
                              ...appSettings,
                              experimentalUnifiedExecEnabled: value,
                            })
                          }
                        />
                      </div>
                      <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                        <div className="space-y-1">
                          <Label htmlFor="experimental-steer">
                            {t("settings.experimental.steer.title")}
                          </Label>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.experimental.steer.subtitle")}
                          </div>
                        </div>
                        <Switch
                          id="experimental-steer"
                          checked={appSettings.experimentalSteerEnabled}
                          onCheckedChange={(value) =>
                            void onUpdateAppSettings({
                              ...appSettings,
                              experimentalSteerEnabled: value,
                            })
                          }
                        />
                      </div>
                      </div>
                    </SettingsSection>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </div>
    );
}




