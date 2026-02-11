import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ask, open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import LayoutGrid from "lucide-react/dist/esm/icons/layout-grid";
import SlidersHorizontal from "lucide-react/dist/esm/icons/sliders-horizontal";
import Mic from "lucide-react/dist/esm/icons/mic";
import Keyboard from "lucide-react/dist/esm/icons/keyboard";
import TerminalSquare from "lucide-react/dist/esm/icons/terminal-square";
import FileText from "lucide-react/dist/esm/icons/file-text";
import X from "lucide-react/dist/esm/icons/x";
import FlaskConical from "lucide-react/dist/esm/icons/flask-conical";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import Bot from "lucide-react/dist/esm/icons/bot";
import type {
  AppSettings,
  CodexDoctorResult,
  DictationModelStatus,
  ModelOption,
  NanobotDingTalkTestResult,
  OpenAppTarget,
  WorkspaceGroup,
  WorkspaceInfo,
  WorkspaceSettings,
} from "../../../types";
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
import { pushErrorToast } from "@/services/toasts";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  clampCodeFontSize,
  CODE_FONT_SIZE_DEFAULT,
  CODE_FONT_SIZE_MAX,
  CODE_FONT_SIZE_MIN,
  DEFAULT_CODE_FONT_FAMILY,
  DEFAULT_UI_FONT_FAMILY,
  normalizeFontFamily,
} from "../../../utils/fonts";
import { DEFAULT_OPEN_APP_ID, OPEN_APP_STORAGE_KEY } from "../../app/constants";
import { useGlobalAgentsMd } from "../hooks/useGlobalAgentsMd";
import { useGlobalCodexConfigToml } from "../hooks/useGlobalCodexConfigToml";
import { ProjectsTabSection } from "./sections/ProjectsTabSection";
import { DisplayTabSection } from "./sections/DisplayTabSection";
import { ComposerTabSection } from "./sections/ComposerTabSection";
import { DictationTabSection } from "./sections/DictationTabSection";
import { ShortcutsTabSection } from "./sections/ShortcutsTabSection";
import { OpenAppsTabSection } from "./sections/OpenAppsTabSection";
import { NanobotTabSection } from "./sections/NanobotTabSection";
import { CodexTabSection } from "./sections/CodexTabSection";
import { ExperimentalTabSection } from "./sections/ExperimentalTabSection";
import {
  CUSTOM_NOTIFICATION_SOUND_ID,
  DEFAULT_NOTIFICATION_ERROR_ID,
  DEFAULT_NOTIFICATION_SUCCESS_ID,
} from "../../../utils/notificationSoundDefaults";
import {
  defaultNotificationErrorSoundUrl,
  defaultNotificationSuccessSoundUrl,
  notificationSoundOptions,
  resolveNotificationSoundUrl,
} from "../../../utils/notificationSoundSources";

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
const SOUND_CUSTOM_VALUE = CUSTOM_NOTIFICATION_SOUND_ID;

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

const COMPOSER_PRESET_CONFIGS: Record<ComposerPreset, ComposerPresetSettings> =
{
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
  onMoveWorkspaceGroup: (
    id: string,
    direction: "up" | "down",
  ) => Promise<boolean | null>;
  onDeleteWorkspaceGroup: (id: string) => Promise<boolean | null>;
  onAssignWorkspaceGroup: (
    workspaceId: string,
    groupId: string | null,
  ) => Promise<boolean | null>;
  reduceTransparency: boolean;
  onToggleTransparency: (value: boolean) => void;
  appSettings: AppSettings;
  models: ModelOption[];
  openAppIconById: Record<string, string>;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  onRunDoctor: (
    codexBin: string | null,
    codexArgs: string | null,
  ) => Promise<CodexDoctorResult>;
  onGetNanobotConfigPath: () => Promise<string>;
  onTestNanobotDingTalk: (
    clientId: string,
    clientSecret: string,
  ) => Promise<NanobotDingTalkTestResult>;
  onClearNanobotThreads?: (options?: { previewOnly?: boolean }) => Promise<{
    cleared: number;
    workspaceName: string;
    candidateCount?: number;
    candidates?: Array<{
      id: string;
      name: string;
    }>;
  }>;
  nanobotAwayDetected?: boolean;
  nanobotBluetoothState?: {
    supported: boolean;
    scanning: boolean;
    nearby: boolean | null;
    error: string | null;
    lastSeenAt: number | null;
  };
  nanobotBluetoothDevices?: Array<{
    id: string;
    name: string;
    rssi?: number | null;
  }>;
  onStartNanobotBluetoothScan?: () => Promise<void>;
  onStopNanobotBluetoothScan?: () => void;
  nanobotWorkspace?: WorkspaceInfo | null;
  onUpdateWorkspaceCodexBin: (
    id: string,
    codexBin: string | null,
  ) => Promise<void>;
  onUpdateWorkspaceSettings: (
    id: string,
    settings: Partial<WorkspaceSettings>,
  ) => Promise<void>;
  scaleShortcutTitle: string;
  scaleShortcutText: string;
  onTestNotificationSound: (
    type?: "success" | "error",
    options?: { url?: string; volume?: number },
  ) => void;
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
  | "open-apps"
  | "nanobot";
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

const shortcutDraftKeyBySetting: Record<ShortcutSettingKey, ShortcutDraftKey> =
{
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
  models,
  openAppIconById,
  onUpdateAppSettings,
  onRunDoctor,
  onGetNanobotConfigPath,
  onTestNanobotDingTalk,
  onClearNanobotThreads,
  nanobotAwayDetected = false,
  nanobotBluetoothState,
  nanobotBluetoothDevices = [],
  onStartNanobotBluetoothScan,
  onStopNanobotBluetoothScan,
  nanobotWorkspace = null,
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
  const platform = useMemo(() => getPlatformKind(), []);
  const fileManagerLabel = useMemo(() => {
    if (platform === "macos") {
      return t("settings.platform.finder");
    }
    if (platform === "windows") {
      return t("settings.platform.fileExplorer");
    }
    return t("settings.platform.fileManager");
  }, [platform, t]);
  const openInFileManagerLabel = useMemo(
    () =>
      t("settings.experimental.openInFileManager", { label: fileManagerLabel }),
    [fileManagerLabel, t],
  );
  const notificationSoundSelectOptions = useMemo(() => {
    const customOption = {
      id: SOUND_CUSTOM_VALUE,
      label: t("settings.display.notificationSounds.custom"),
    };
    return {
      success: [
        {
          id: DEFAULT_NOTIFICATION_SUCCESS_ID,
          label: t("settings.display.notificationSounds.defaultSuccess"),
        },
        ...notificationSoundOptions,
        customOption,
      ],
      error: [
        {
          id: DEFAULT_NOTIFICATION_ERROR_ID,
          label: t("settings.display.notificationSounds.defaultError"),
        },
        ...notificationSoundOptions,
        customOption,
      ],
    };
  }, [t]);
  const formatSoundPathLabel = useCallback(
    (path: string | null) => {
      if (!path) {
        return t("settings.display.notificationSounds.chooseFile");
      }
      const name = path.split(/[/\\\\]/).pop() ?? path;
      return t("settings.display.notificationSounds.customSelected", { name });
    },
    [t],
  );
  const pickSoundFile = useCallback(async () => {
    const selection = await open({
      multiple: false,
      filters: [
        {
          name: "Audio",
          extensions: ["aac", "m4a", "mp3", "wav", "ogg", "flac"],
        },
      ],
    });
    if (!selection || Array.isArray(selection)) {
      return null;
    }
    return selection;
  }, []);
  const handleSelectNotificationSound = useCallback(
    async (type: "success" | "error", value: string) => {
      if (value === SOUND_CUSTOM_VALUE) {
        const selection = await pickSoundFile();
        if (!selection) {
          return;
        }
        void onUpdateAppSettings({
          ...appSettings,
          notificationSoundSuccessId:
            type === "success" ? SOUND_CUSTOM_VALUE : appSettings.notificationSoundSuccessId,
          notificationSoundSuccessPath:
            type === "success" ? selection : appSettings.notificationSoundSuccessPath,
          notificationSoundErrorId:
            type === "error" ? SOUND_CUSTOM_VALUE : appSettings.notificationSoundErrorId,
          notificationSoundErrorPath:
            type === "error" ? selection : appSettings.notificationSoundErrorPath,
          notificationSoundVolume:
            type === "success"
              ? appSettings.notificationSoundSuccessVolume
              : appSettings.notificationSoundErrorVolume,
        });
        if (appSettings.notificationSoundsEnabled) {
          const url = resolveNotificationSoundUrl({
            soundId: SOUND_CUSTOM_VALUE,
            soundPath: selection,
            fallbackUrl:
              type === "success"
                ? defaultNotificationSuccessSoundUrl
                : defaultNotificationErrorSoundUrl,
          });
          const volume =
            type === "success"
              ? appSettings.notificationSoundSuccessVolume
              : appSettings.notificationSoundErrorVolume;
          onTestNotificationSound(type, { url, volume });
        }
        return;
      }
      void onUpdateAppSettings({
        ...appSettings,
        notificationSoundSuccessId:
          type === "success" ? value : appSettings.notificationSoundSuccessId,
        notificationSoundSuccessPath:
          type === "success" ? null : appSettings.notificationSoundSuccessPath,
        notificationSoundErrorId:
          type === "error" ? value : appSettings.notificationSoundErrorId,
        notificationSoundErrorPath:
          type === "error" ? null : appSettings.notificationSoundErrorPath,
        notificationSoundVolume:
          type === "success"
            ? appSettings.notificationSoundSuccessVolume
            : appSettings.notificationSoundErrorVolume,
      });
      if (appSettings.notificationSoundsEnabled) {
        const url = resolveNotificationSoundUrl({
          soundId: value,
          soundPath: null,
          fallbackUrl:
            type === "success"
              ? defaultNotificationSuccessSoundUrl
              : defaultNotificationErrorSoundUrl,
        });
        const volume =
          type === "success"
            ? appSettings.notificationSoundSuccessVolume
            : appSettings.notificationSoundErrorVolume;
        onTestNotificationSound(type, { url, volume });
      }
    },
    [appSettings, onTestNotificationSound, onUpdateAppSettings, pickSoundFile],
  );
  const handlePickCustomSound = useCallback(
    async (type: "success" | "error") => {
      const selection = await pickSoundFile();
      if (!selection) {
        return;
      }
      void onUpdateAppSettings({
        ...appSettings,
        notificationSoundSuccessId:
          type === "success" ? SOUND_CUSTOM_VALUE : appSettings.notificationSoundSuccessId,
        notificationSoundSuccessPath:
          type === "success" ? selection : appSettings.notificationSoundSuccessPath,
        notificationSoundErrorId:
          type === "error" ? SOUND_CUSTOM_VALUE : appSettings.notificationSoundErrorId,
        notificationSoundErrorPath:
          type === "error" ? selection : appSettings.notificationSoundErrorPath,
        notificationSoundVolume:
          type === "success"
            ? appSettings.notificationSoundSuccessVolume
            : appSettings.notificationSoundErrorVolume,
      });
      if (appSettings.notificationSoundsEnabled) {
        const url = resolveNotificationSoundUrl({
          soundId: SOUND_CUSTOM_VALUE,
          soundPath: selection,
          fallbackUrl:
            type === "success"
              ? defaultNotificationSuccessSoundUrl
              : defaultNotificationErrorSoundUrl,
        });
        const volume =
          type === "success"
            ? appSettings.notificationSoundSuccessVolume
            : appSettings.notificationSoundErrorVolume;
        onTestNotificationSound(type, { url, volume });
      }
    },
    [appSettings, onTestNotificationSound, onUpdateAppSettings, pickSoundFile],
  );
  const successVolumePercent = Math.round(
    (appSettings.notificationSoundSuccessVolume ?? 0) * 100,
  );
  const errorVolumePercent = Math.round(
    (appSettings.notificationSoundErrorVolume ?? 0) * 100,
  );
  const successSoundValue =
    appSettings.notificationSoundSuccessId ?? DEFAULT_NOTIFICATION_SUCCESS_ID;
  const errorSoundValue =
    appSettings.notificationSoundErrorId ?? DEFAULT_NOTIFICATION_ERROR_ID;
  const successSoundIsCustom = successSoundValue === SOUND_CUSTOM_VALUE;
  const errorSoundIsCustom = errorSoundValue === SOUND_CUSTOM_VALUE;
  const normalizeWindowsPath = useCallback(
    (value: string | null) => {
      if (!value || platform !== "windows") {
        return value;
      }
      const trimmed = value.trim();
      const unquoted =
        trimmed.startsWith('"') && trimmed.endsWith('"')
          ? trimmed.slice(1, -1)
          : trimmed;
      return unquoted.replace(/\//g, "\\");
    },
    [platform],
  );
  const [activeSection, setActiveSection] = useState<CodexSection>("projects");
  const [codexPathDraft, setCodexPathDraft] = useState(
    appSettings.codexBin ?? "",
  );
  const [codexArgsDraft, setCodexArgsDraft] = useState(
    appSettings.codexArgs ?? "",
  );
  const [remoteHostDraft, setRemoteHostDraft] = useState(
    appSettings.remoteBackendHost,
  );
  const [remoteTokenDraft, setRemoteTokenDraft] = useState(
    appSettings.remoteBackendToken ?? "",
  );
  const [happyServerDraft, setHappyServerDraft] = useState(
    appSettings.happyServerUrl,
  );
  const [yunyiTokenDraft, setYunyiTokenDraft] = useState(
    appSettings.experimentalYunyiToken,
  );
  const [nanobotClientIdDraft, setNanobotClientIdDraft] = useState(
    appSettings.nanobotDingTalkClientId,
  );
  const [nanobotClientSecretDraft, setNanobotClientSecretDraft] = useState(
    appSettings.nanobotDingTalkClientSecret,
  );
  const [nanobotAgentModelDraft, setNanobotAgentModelDraft] = useState(
    appSettings.nanobotAgentModel,
  );
  const [nanobotAgentReasoningEffortDraft, setNanobotAgentReasoningEffortDraft] =
    useState(appSettings.nanobotAgentReasoningEffort ?? "");
  const [nanobotAllowFromDraft, setNanobotAllowFromDraft] = useState(
    appSettings.nanobotDingTalkAllowFrom,
  );
  const [nanobotEmailImapHostDraft, setNanobotEmailImapHostDraft] = useState(
    appSettings.nanobotEmailImapHost,
  );
  const [nanobotEmailImapPortDraft, setNanobotEmailImapPortDraft] = useState(
    String(appSettings.nanobotEmailImapPort),
  );
  const [nanobotEmailImapUsernameDraft, setNanobotEmailImapUsernameDraft] =
    useState(appSettings.nanobotEmailImapUsername);
  const [nanobotEmailImapPasswordDraft, setNanobotEmailImapPasswordDraft] =
    useState(appSettings.nanobotEmailImapPassword);
  const [nanobotEmailImapMailboxDraft, setNanobotEmailImapMailboxDraft] =
    useState(appSettings.nanobotEmailImapMailbox);
  const [nanobotEmailSmtpHostDraft, setNanobotEmailSmtpHostDraft] = useState(
    appSettings.nanobotEmailSmtpHost,
  );
  const [nanobotEmailSmtpPortDraft, setNanobotEmailSmtpPortDraft] = useState(
    String(appSettings.nanobotEmailSmtpPort),
  );
  const [nanobotEmailSmtpUsernameDraft, setNanobotEmailSmtpUsernameDraft] =
    useState(appSettings.nanobotEmailSmtpUsername);
  const [nanobotEmailSmtpPasswordDraft, setNanobotEmailSmtpPasswordDraft] =
    useState(appSettings.nanobotEmailSmtpPassword);
  const [nanobotEmailFromAddressDraft, setNanobotEmailFromAddressDraft] =
    useState(appSettings.nanobotEmailFromAddress);
  const [nanobotEmailAllowFromDraft, setNanobotEmailAllowFromDraft] = useState(
    appSettings.nanobotEmailAllowFrom,
  );
  const [nanobotEmailPollIntervalDraft, setNanobotEmailPollIntervalDraft] =
    useState(String(appSettings.nanobotEmailPollIntervalSeconds));
  const [nanobotQqAppIdDraft, setNanobotQqAppIdDraft] = useState(
    appSettings.nanobotQqAppId,
  );
  const [nanobotQqSecretDraft, setNanobotQqSecretDraft] = useState(
    appSettings.nanobotQqSecret,
  );
  const [nanobotQqAllowFromDraft, setNanobotQqAllowFromDraft] = useState(
    appSettings.nanobotQqAllowFrom,
  );
  const [nanobotCodexBinDraft, setNanobotCodexBinDraft] = useState(
    nanobotWorkspace?.codex_bin ?? "",
  );
  const [nanobotCodexBinSaving, setNanobotCodexBinSaving] = useState(false);
  const [nanobotCodexBinSavedAt, setNanobotCodexBinSavedAt] = useState(0);
  const [nanobotConfigPath, setNanobotConfigPath] = useState<string | null>(null);
  const [nanobotConfigPathError, setNanobotConfigPathError] = useState<string | null>(
    null,
  );
  const [nanobotTestState, setNanobotTestState] = useState<{
    status: "idle" | "running" | "done";
    result: NanobotDingTalkTestResult | null;
  }>({ status: "idle", result: null });
  const [nanobotCleanupState, setNanobotCleanupState] = useState<{
    status: "idle" | "running" | "done";
    ok: boolean;
    message: string | null;
  }>({
    status: "idle",
    ok: true,
    message: null,
  });
  const [scaleDraft, setScaleDraft] = useState(
    `${Math.round(clampUiScale(appSettings.uiScale) * 100)}%`,
  );
  const [uiFontDraft, setUiFontDraft] = useState(appSettings.uiFontFamily);
  const [codeFontDraft, setCodeFontDraft] = useState(
    appSettings.codeFontFamily,
  );
  const [codeFontSizeDraft, setCodeFontSizeDraft] = useState(
    appSettings.codeFontSize,
  );
  const [codexBinOverrideDrafts, setCodexBinOverrideDrafts] = useState<
    Record<string, string>
  >({});
  const [codexBinOverrideSaving, setCodexBinOverrideSaving] = useState<
    Record<string, boolean>
  >({});
  const [codexBinOverrideSavedAt, setCodexBinOverrideSavedAt] = useState<
    Record<string, number>
  >({});
  const [codexBinOverrideDoctor, setCodexBinOverrideDoctor] = useState<
    Record<
      string,
      {
        status: "idle" | "running" | "done";
        result: CodexDoctorResult | null;
        error?: string;
      }
    >
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
  const globalAgentsSaveDisabled =
    globalAgentsLoading || globalAgentsSaving || !globalAgentsDirty;
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
  const globalConfigSaveDisabled =
    globalConfigLoading || globalConfigSaving || !globalConfigDirty;
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
    setHappyServerDraft(appSettings.happyServerUrl);
  }, [appSettings.happyServerUrl]);

  useEffect(() => {
    setYunyiTokenDraft(appSettings.experimentalYunyiToken);
  }, [appSettings.experimentalYunyiToken]);

  useEffect(() => {
    setNanobotClientIdDraft(appSettings.nanobotDingTalkClientId);
  }, [appSettings.nanobotDingTalkClientId]);

  useEffect(() => {
    setNanobotClientSecretDraft(appSettings.nanobotDingTalkClientSecret);
  }, [appSettings.nanobotDingTalkClientSecret]);

  useEffect(() => {
    setNanobotAgentModelDraft(appSettings.nanobotAgentModel);
  }, [appSettings.nanobotAgentModel]);

  useEffect(() => {
    setNanobotAgentReasoningEffortDraft(
      appSettings.nanobotAgentReasoningEffort ?? "",
    );
  }, [appSettings.nanobotAgentReasoningEffort]);

  useEffect(() => {
    setNanobotAllowFromDraft(appSettings.nanobotDingTalkAllowFrom);
  }, [appSettings.nanobotDingTalkAllowFrom]);

  useEffect(() => {
    setNanobotEmailImapHostDraft(appSettings.nanobotEmailImapHost);
  }, [appSettings.nanobotEmailImapHost]);

  useEffect(() => {
    setNanobotEmailImapPortDraft(String(appSettings.nanobotEmailImapPort));
  }, [appSettings.nanobotEmailImapPort]);

  useEffect(() => {
    setNanobotEmailImapUsernameDraft(appSettings.nanobotEmailImapUsername);
  }, [appSettings.nanobotEmailImapUsername]);

  useEffect(() => {
    setNanobotEmailImapPasswordDraft(appSettings.nanobotEmailImapPassword);
  }, [appSettings.nanobotEmailImapPassword]);

  useEffect(() => {
    setNanobotEmailImapMailboxDraft(appSettings.nanobotEmailImapMailbox);
  }, [appSettings.nanobotEmailImapMailbox]);

  useEffect(() => {
    setNanobotEmailSmtpHostDraft(appSettings.nanobotEmailSmtpHost);
  }, [appSettings.nanobotEmailSmtpHost]);

  useEffect(() => {
    setNanobotEmailSmtpPortDraft(String(appSettings.nanobotEmailSmtpPort));
  }, [appSettings.nanobotEmailSmtpPort]);

  useEffect(() => {
    setNanobotEmailSmtpUsernameDraft(appSettings.nanobotEmailSmtpUsername);
  }, [appSettings.nanobotEmailSmtpUsername]);

  useEffect(() => {
    setNanobotEmailSmtpPasswordDraft(appSettings.nanobotEmailSmtpPassword);
  }, [appSettings.nanobotEmailSmtpPassword]);

  useEffect(() => {
    setNanobotEmailFromAddressDraft(appSettings.nanobotEmailFromAddress);
  }, [appSettings.nanobotEmailFromAddress]);

  useEffect(() => {
    setNanobotEmailAllowFromDraft(appSettings.nanobotEmailAllowFrom);
  }, [appSettings.nanobotEmailAllowFrom]);

  useEffect(() => {
    setNanobotEmailPollIntervalDraft(
      String(appSettings.nanobotEmailPollIntervalSeconds),
    );
  }, [appSettings.nanobotEmailPollIntervalSeconds]);

  useEffect(() => {
    setNanobotQqAppIdDraft(appSettings.nanobotQqAppId);
  }, [appSettings.nanobotQqAppId]);

  useEffect(() => {
    setNanobotQqSecretDraft(appSettings.nanobotQqSecret);
  }, [appSettings.nanobotQqSecret]);

  useEffect(() => {
    setNanobotQqAllowFromDraft(appSettings.nanobotQqAllowFrom);
  }, [appSettings.nanobotQqAllowFrom]);

  useEffect(() => {
    setNanobotCodexBinDraft(nanobotWorkspace?.codex_bin ?? "");
  }, [nanobotWorkspace?.codex_bin]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const path = await onGetNanobotConfigPath();
        if (!active) {
          return;
        }
        setNanobotConfigPath(path);
        setNanobotConfigPathError(null);
      } catch (error) {
        if (!active) {
          return;
        }
        setNanobotConfigPath(null);
        setNanobotConfigPathError(
          error instanceof Error ? error.message : String(error),
        );
      }
    })();
    return () => {
      active = false;
    };
  }, [onGetNanobotConfigPath]);

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

  const nanobotAgentSelectedModelOption = useMemo(() => {
    const draft = nanobotAgentModelDraft.trim();
    if (!draft) {
      return null;
    }
    return (
      models.find((model) => model.id === draft || model.model === draft) ?? null
    );
  }, [models, nanobotAgentModelDraft]);
  const nanobotAgentModelSelectValue = nanobotAgentModelDraft.trim()
    ? (nanobotAgentSelectedModelOption?.id ?? "__nanobot-model-custom__")
    : "__nanobot-model-default__";
  const nanobotAgentReasoningOptions = useMemo(() => {
    const values = new Set<string>();
    if (nanobotAgentSelectedModelOption) {
      nanobotAgentSelectedModelOption.supportedReasoningEfforts.forEach((effort) => {
        const value = effort.reasoningEffort.trim();
        if (value) {
          values.add(value);
        }
      });
      const defaultEffort = nanobotAgentSelectedModelOption.defaultReasoningEffort?.trim();
      if (defaultEffort) {
        values.add(defaultEffort);
      }
    }
    const draftEffort = nanobotAgentReasoningEffortDraft.trim();
    if (draftEffort) {
      values.add(draftEffort);
    }
    return Array.from(values);
  }, [nanobotAgentReasoningEffortDraft, nanobotAgentSelectedModelOption]);

  const nextCodexBin = normalizeWindowsPath(
    codexPathDraft.trim() ? codexPathDraft.trim() : null,
  );
  const nextCodexArgs = codexArgsDraft.trim() ? codexArgsDraft.trim() : null;
  const codexDirty =
    nextCodexBin !== (appSettings.codexBin ?? null) ||
    nextCodexArgs !== (appSettings.codexArgs ?? null);
  const nextNanobotClientId = nanobotClientIdDraft.trim();
  const nextNanobotClientSecret = nanobotClientSecretDraft.trim();
  const nextNanobotAgentModel = nanobotAgentModelDraft.trim();
  const nextNanobotAgentReasoningEffort =
    nanobotAgentReasoningEffortDraft.trim() || null;
  const nextNanobotAllowFrom = nanobotAllowFromDraft.trim();
  const nextNanobotEmailImapHost = nanobotEmailImapHostDraft.trim();
  const nextNanobotEmailImapPort = Math.min(
    65535,
    Math.max(1, Number.parseInt(nanobotEmailImapPortDraft.trim(), 10) || 993),
  );
  const nextNanobotEmailImapUsername = nanobotEmailImapUsernameDraft.trim();
  const nextNanobotEmailImapPassword = nanobotEmailImapPasswordDraft.trim();
  const nextNanobotEmailImapMailbox =
    nanobotEmailImapMailboxDraft.trim() || "INBOX";
  const nextNanobotEmailSmtpHost = nanobotEmailSmtpHostDraft.trim();
  const nextNanobotEmailSmtpPort = Math.min(
    65535,
    Math.max(1, Number.parseInt(nanobotEmailSmtpPortDraft.trim(), 10) || 587),
  );
  const nextNanobotEmailSmtpUsername = nanobotEmailSmtpUsernameDraft.trim();
  const nextNanobotEmailSmtpPassword = nanobotEmailSmtpPasswordDraft.trim();
  const nextNanobotEmailFromAddress = nanobotEmailFromAddressDraft.trim();
  const nextNanobotEmailAllowFrom = nanobotEmailAllowFromDraft.trim();
  const nextNanobotEmailPollIntervalSeconds = Math.max(
    5,
    Number.parseInt(nanobotEmailPollIntervalDraft.trim(), 10) || 30,
  );
  const nextNanobotQqAppId = nanobotQqAppIdDraft.trim();
  const nextNanobotQqSecret = nanobotQqSecretDraft.trim();
  const nextNanobotQqAllowFrom = nanobotQqAllowFromDraft.trim();
  const nanobotDirty =
    nextNanobotClientId !== appSettings.nanobotDingTalkClientId ||
    nextNanobotClientSecret !== appSettings.nanobotDingTalkClientSecret ||
    nextNanobotAgentModel !== appSettings.nanobotAgentModel ||
    nextNanobotAgentReasoningEffort !== appSettings.nanobotAgentReasoningEffort ||
    nextNanobotAllowFrom !== appSettings.nanobotDingTalkAllowFrom ||
    nextNanobotEmailImapHost !== appSettings.nanobotEmailImapHost ||
    nextNanobotEmailImapPort !== appSettings.nanobotEmailImapPort ||
    nextNanobotEmailImapUsername !== appSettings.nanobotEmailImapUsername ||
    nextNanobotEmailImapPassword !== appSettings.nanobotEmailImapPassword ||
    nextNanobotEmailImapMailbox !== appSettings.nanobotEmailImapMailbox ||
    nextNanobotEmailSmtpHost !== appSettings.nanobotEmailSmtpHost ||
    nextNanobotEmailSmtpPort !== appSettings.nanobotEmailSmtpPort ||
    nextNanobotEmailSmtpUsername !== appSettings.nanobotEmailSmtpUsername ||
    nextNanobotEmailSmtpPassword !== appSettings.nanobotEmailSmtpPassword ||
    nextNanobotEmailFromAddress !== appSettings.nanobotEmailFromAddress ||
    nextNanobotEmailAllowFrom !== appSettings.nanobotEmailAllowFrom ||
    nextNanobotQqAppId !== appSettings.nanobotQqAppId ||
    nextNanobotQqSecret !== appSettings.nanobotQqSecret ||
    nextNanobotQqAllowFrom !== appSettings.nanobotQqAllowFrom ||
    nextNanobotEmailPollIntervalSeconds !==
      appSettings.nanobotEmailPollIntervalSeconds;

  const trimmedScale = scaleDraft.trim();
  const parsedPercent = trimmedScale
    ? Number(trimmedScale.replace("%", ""))
    : Number.NaN;
  const parsedScale = Number.isFinite(parsedPercent)
    ? parsedPercent / 100
    : null;

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

  const handleSaveNanobotSettings = async () => {
    setIsSavingSettings(true);
    try {
      await onUpdateAppSettings({
        ...appSettings,
        nanobotDingTalkClientId: nextNanobotClientId,
        nanobotDingTalkClientSecret: nextNanobotClientSecret,
        nanobotAgentModel: nextNanobotAgentModel,
        nanobotAgentReasoningEffort: nextNanobotAgentReasoningEffort,
        nanobotDingTalkAllowFrom: nextNanobotAllowFrom,
        nanobotEmailImapHost: nextNanobotEmailImapHost,
        nanobotEmailImapPort: nextNanobotEmailImapPort,
        nanobotEmailImapUsername: nextNanobotEmailImapUsername,
        nanobotEmailImapPassword: nextNanobotEmailImapPassword,
        nanobotEmailImapMailbox: nextNanobotEmailImapMailbox,
        nanobotEmailSmtpHost: nextNanobotEmailSmtpHost,
        nanobotEmailSmtpPort: nextNanobotEmailSmtpPort,
        nanobotEmailSmtpUsername: nextNanobotEmailSmtpUsername,
        nanobotEmailSmtpPassword: nextNanobotEmailSmtpPassword,
        nanobotEmailFromAddress: nextNanobotEmailFromAddress,
        nanobotEmailAllowFrom: nextNanobotEmailAllowFrom,
        nanobotEmailPollIntervalSeconds: nextNanobotEmailPollIntervalSeconds,
        nanobotQqAppId: nextNanobotQqAppId,
        nanobotQqSecret: nextNanobotQqSecret,
        nanobotQqAllowFrom: nextNanobotQqAllowFrom,
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCommitNanobotCodexBin = useCallback(async (draftValue?: string) => {
    if (!nanobotWorkspace) {
      return;
    }
    const nextValue = normalizeWindowsPath(
      normalizeOverrideValue(draftValue ?? nanobotCodexBinDraft),
    );
    const previousValue = nanobotWorkspace.codex_bin ?? null;
    if (nextValue === previousValue) {
      return;
    }
    setNanobotCodexBinSaving(true);
    try {
      await onUpdateWorkspaceCodexBin(nanobotWorkspace.id, nextValue);
      setNanobotCodexBinSavedAt(Date.now());
      window.setTimeout(() => {
        setNanobotCodexBinSavedAt(0);
      }, 2000);
    } finally {
      setNanobotCodexBinSaving(false);
    }
  }, [
    nanobotWorkspace,
    nanobotCodexBinDraft,
    normalizeWindowsPath,
    onUpdateWorkspaceCodexBin,
  ]);
  const persistNanobotAgentOverrides = useCallback(
    async (nextModel: string, nextReasoningEffort: string | null) => {
      if (
        nextModel === appSettings.nanobotAgentModel &&
        nextReasoningEffort === appSettings.nanobotAgentReasoningEffort
      ) {
        return;
      }
      try {
        await onUpdateAppSettings({
          ...appSettings,
          nanobotAgentModel: nextModel,
          nanobotAgentReasoningEffort: nextReasoningEffort,
        });
      } catch (error) {
        pushErrorToast({
          title: t("settings.nanobot.agentOverrides.saveErrorTitle"),
          message:
            error instanceof Error
              ? error.message
              : t("settings.nanobot.agentOverrides.saveErrorMessage"),
        });
      }
    },
    [appSettings, onUpdateAppSettings, t],
  );
  const handleSelectNanobotAgentModel = useCallback(
    (value: string) => {
      const nextReasoningEffort = nanobotAgentReasoningEffortDraft.trim() || null;
      if (value === "__nanobot-model-default__") {
        setNanobotAgentModelDraft("");
        void persistNanobotAgentOverrides("", nextReasoningEffort);
        return;
      }
      const selected = models.find((model) => model.id === value);
      if (!selected) {
        return;
      }
      const nextModel = selected.model;
      setNanobotAgentModelDraft(nextModel);
      void persistNanobotAgentOverrides(nextModel, nextReasoningEffort);
    },
    [models, nanobotAgentReasoningEffortDraft, persistNanobotAgentOverrides],
  );
  const handleSelectNanobotAgentReasoningEffort = useCallback((value: string) => {
    const nextModel = nanobotAgentModelDraft.trim();
    if (value === "__nanobot-effort-default__") {
      setNanobotAgentReasoningEffortDraft("");
      void persistNanobotAgentOverrides(nextModel, null);
      return;
    }
    setNanobotAgentReasoningEffortDraft(value);
    void persistNanobotAgentOverrides(nextModel, value);
  }, [nanobotAgentModelDraft, persistNanobotAgentOverrides]);

  const handleCommitCodexBinOverride = useCallback(
    async (workspace: WorkspaceInfo) => {
      const draft = codexBinOverrideDrafts[workspace.id] ?? "";
      const nextValue = normalizeWindowsPath(normalizeOverrideValue(draft));
      const previousValue = workspace.codex_bin ?? null;
      if (nextValue === previousValue) {
        return;
      }
      setCodexBinOverrideDrafts((prev) => ({
        ...prev,
        [workspace.id]: nextValue ?? "",
      }));
      setCodexBinOverrideSaving((prev) => ({ ...prev, [workspace.id]: true }));
      try {
        await onUpdateWorkspaceCodexBin(workspace.id, nextValue);
        setCodexBinOverrideSavedAt((prev) => ({
          ...prev,
          [workspace.id]: Date.now(),
        }));
        window.setTimeout(() => {
          setCodexBinOverrideSavedAt((prev) => {
            if (!prev[workspace.id]) {
              return prev;
            }
            const next = { ...prev };
            delete next[workspace.id];
            return next;
          });
        }, 2000);
      } catch (error) {
        setCodexBinOverrideDrafts((prev) => ({
          ...prev,
          [workspace.id]: previousValue ?? "",
        }));
        pushErrorToast({
          title: t("settings.codex.workspaceOverrides.saveErrorTitle"),
          message:
            error instanceof Error
              ? error.message
              : t("settings.codex.workspaceOverrides.saveErrorMessage"),
        });
      } finally {
        setCodexBinOverrideSaving((prev) => ({
          ...prev,
          [workspace.id]: false,
        }));
      }
    },
    [
      codexBinOverrideDrafts,
      setCodexBinOverrideSaving,
      onUpdateWorkspaceCodexBin,
      normalizeWindowsPath,
      setCodexBinOverrideDrafts,
      setCodexBinOverrideSavedAt,
      t,
    ],
  );

  const handleRunWorkspaceDoctor = useCallback(
    async (workspace: WorkspaceInfo) => {
      const resolvedBin =
        normalizeWindowsPath(workspace.codex_bin ?? appSettings.codexBin) ??
        null;
      const resolvedArgs =
        workspace.settings.codexArgs ?? appSettings.codexArgs ?? null;
      setCodexBinOverrideDoctor((prev) => ({
        ...prev,
        [workspace.id]: { status: "running", result: null },
      }));
      try {
        const result = await onRunDoctor(resolvedBin, resolvedArgs);
        setCodexBinOverrideDoctor((prev) => ({
          ...prev,
          [workspace.id]: { status: "done", result },
        }));
      } catch (error) {
        setCodexBinOverrideDoctor((prev) => ({
          ...prev,
          [workspace.id]: {
            status: "done",
            result: null,
            error: error instanceof Error ? error.message : String(error),
          },
        }));
      }
    },
    [
      appSettings.codexArgs,
      appSettings.codexBin,
      normalizeWindowsPath,
      onRunDoctor,
    ],
  );

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

  const handleCommitHappyServer = async () => {
    const nextUrl = happyServerDraft.trim() || appSettings.happyServerUrl;
    setHappyServerDraft(nextUrl);
    if (nextUrl === appSettings.happyServerUrl) {
      return;
    }
    await onUpdateAppSettings({
      ...appSettings,
      happyServerUrl: nextUrl,
    });
  };

  const handleCommitYunyiToken = async () => {
    const nextToken = yunyiTokenDraft.trim();
    setYunyiTokenDraft(nextToken);
    if (nextToken === appSettings.experimentalYunyiToken) {
      return;
    }
    await onUpdateAppSettings({
      ...appSettings,
      experimentalYunyiToken: nextToken,
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
    const nextFont = normalizeFontFamily(uiFontDraft, DEFAULT_UI_FONT_FAMILY);
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

  const handleOpenAppKindChange = (
    index: number,
    kind: OpenAppTarget["kind"],
  ) => {
    setOpenAppDrafts((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) {
        return prev;
      }
      next[index] = {
        ...current,
        kind,
        appName: kind === "app" ? (current.appName ?? "") : null,
        command: kind === "command" ? (current.command ?? "") : null,
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
      removed?.id === openAppSelectedId
        ? (next[0]?.id ?? DEFAULT_OPEN_APP_ID)
        : openAppSelectedId;
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

  const handleTestNanobotDingTalk = async () => {
    setNanobotTestState({ status: "running", result: null });
    try {
      const result = await onTestNanobotDingTalk(
        nextNanobotClientId,
        nextNanobotClientSecret,
      );
      setNanobotTestState({ status: "done", result });
    } catch (error) {
      setNanobotTestState({
        status: "done",
        result: {
          ok: false,
          endpoint: null,
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  };

  const handleClearNanobotThreads = async () => {
    if (!onClearNanobotThreads) {
      return;
    }
    try {
      const preview = await onClearNanobotThreads({ previewOnly: true });
      const candidateCount =
        preview.candidateCount ?? preview.candidates?.length ?? 0;
      const previewItems = (preview.candidates ?? []).slice(0, 5);
      const previewLines = previewItems.map(
        (thread, index) => `${index + 1}. ${thread.name}`,
      );
      const confirmParts = [t("settings.nanobot.cleanup.confirm")];
      if (candidateCount > 0) {
        confirmParts.push(
          "",
          t("settings.nanobot.cleanup.preview.count", {
            count: candidateCount,
            workspace: preview.workspaceName,
          }),
        );
        if (previewLines.length > 0) {
          confirmParts.push(
            "",
            t("settings.nanobot.cleanup.preview.examples"),
            ...previewLines,
          );
        }
        if (candidateCount > previewLines.length) {
          confirmParts.push(
            t("settings.nanobot.cleanup.preview.more", {
              count: candidateCount - previewLines.length,
            }),
          );
        }
      } else {
        confirmParts.push(
          "",
          t("settings.nanobot.cleanup.empty", { workspace: preview.workspaceName }),
        );
      }
      const confirmed = await ask(confirmParts.join("\n"), {
        kind: "warning",
        title: t("settings.nanobot.cleanup.title"),
      });
      if (!confirmed) {
        return;
      }
      if (candidateCount === 0) {
        setNanobotCleanupState({
          status: "done",
          ok: true,
          message: t("settings.nanobot.cleanup.empty", {
            workspace: preview.workspaceName,
          }),
        });
        return;
      }
      setNanobotCleanupState({
        status: "running",
        ok: true,
        message: null,
      });
      const result = await onClearNanobotThreads();
      const message =
        result.cleared > 0
          ? t("settings.nanobot.cleanup.success", {
              count: result.cleared,
              workspace: result.workspaceName,
            })
          : t("settings.nanobot.cleanup.empty", {
              workspace: result.workspaceName,
            });
      setNanobotCleanupState({
        status: "done",
        ok: true,
        message,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setNanobotCleanupState({
        status: "done",
        ok: false,
        message: t("settings.nanobot.cleanup.failed", { value: message }),
      });
    }
  };

  const updateShortcut = async (
    key: ShortcutSettingKey,
    value: string | null,
  ) => {
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
      groupedWorkspaces.find((entry) => entry.id === group.id)?.workspaces ??
      [];
    const detail =
      groupProjects.length > 0
        ? `\n\n${t("settings.projects.group.deleteDetail", {
          label: ungroupedLabel,
        })}`
        : "";
    const confirmed = await ask(
      `${t("settings.projects.group.deletePrompt", {
        name: group.name,
      })}${detail}`,
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
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden p-6">
        <div className="relative z-10 flex h-[720px] max-h-[calc(100vh-3rem)] w-[960px] max-w-[calc(100%-3rem)] flex-col overflow-hidden rounded-xl border bg-background shadow-xl">
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
            <TabsList className="h-full w-60 flex-col items-stretch justify-start gap-1 overflow-y-auto rounded-none border-r bg-transparent p-2 text-sm text-muted-foreground">
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
                value="nanobot"
                className="justify-start gap-2 data-[state=active]:bg-muted/60 data-[state=active]:shadow-none"
              >
                <Bot className="h-4 w-4" aria-hidden />
                <span>{t("settings.nav.nanobot")}</span>
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
                            <ProjectsTabSection {...{ t, newGroupName, setNewGroupName, canCreateGroup, handleCreateGroup, groupError, workspaceGroups, groupDrafts, setGroupDrafts, handleRenameGroup, handleChooseGroupCopiesFolder, handleClearGroupCopiesFolder, onMoveWorkspaceGroup, handleDeleteGroup, groupedWorkspaces, onAssignWorkspaceGroup, ungroupedLabel, onMoveWorkspace, onDeleteWorkspace, projects, appSettings, onUpdateAppSettings, UNGROUPED_SELECT_VALUE, cn }} />
                            <DisplayTabSection {...{ t, appSettings, onUpdateAppSettings, reduceTransparency, onToggleTransparency, scaleShortcutTitle, scaleShortcutText, scaleDraft, setScaleDraft, handleCommitScale, handleResetScale, uiFontDraft, setUiFontDraft, handleCommitUiFont, codeFontDraft, setCodeFontDraft, handleCommitCodeFont, codeFontSizeDraft, setCodeFontSizeDraft, handleCommitCodeFontSize, successSoundValue, handleSelectNotificationSound, notificationSoundSelectOptions, successVolumePercent, onTestNotificationSound, successSoundIsCustom, handlePickCustomSound, formatSoundPathLabel, errorSoundValue, errorVolumePercent, errorSoundIsCustom, CODE_FONT_SIZE_DEFAULT, CODE_FONT_SIZE_MAX, CODE_FONT_SIZE_MIN, DEFAULT_CODE_FONT_FAMILY, DEFAULT_UI_FONT_FAMILY }} />
                            <ComposerTabSection {...{ t, appSettings, handleComposerPresetChange, composerPresetLabels, onUpdateAppSettings }} />
                            <DictationTabSection {...{ t, platform, appSettings, onUpdateAppSettings, dictationModelStatus, onCancelDictationDownload, onDownloadDictationModel, dictationModels, selectedDictationModel, dictationProgress, dictationReady, onRemoveDictationModel, DICTATION_AUTO_VALUE, DICTATION_HOLD_OFF_VALUE }} />
                            <ShortcutsTabSection {...{ t, shortcutDrafts, handleShortcutKeyDown, updateShortcut, formatShortcut, getDefaultInterruptShortcut }} />
                            <OpenAppsTabSection {...{ t, openAppDrafts, openAppIconById, handleOpenAppDraftChange, handleCommitOpenApps, handleOpenAppKindChange, fileManagerLabel, openAppSelectedId, handleSelectOpenAppDefault, handleMoveOpenApp, handleDeleteOpenApp, handleAddOpenApp }} />
                            <NanobotTabSection {...{ t, appSettings, onUpdateAppSettings, models, nextNanobotClientId, nextNanobotClientSecret, nextNanobotAgentModel, nextNanobotAgentReasoningEffort, nextNanobotAllowFrom, nextNanobotEmailImapHost, nextNanobotEmailImapPort, nextNanobotEmailImapUsername, nextNanobotEmailImapPassword, nextNanobotEmailImapMailbox, nextNanobotEmailSmtpHost, nextNanobotEmailSmtpPort, nextNanobotEmailSmtpUsername, nextNanobotEmailSmtpPassword, nextNanobotEmailFromAddress, nextNanobotEmailAllowFrom, nextNanobotEmailPollIntervalSeconds, nextNanobotQqAppId, nextNanobotQqSecret, nextNanobotQqAllowFrom, nanobotClientIdDraft, setNanobotClientIdDraft, nanobotClientSecretDraft, setNanobotClientSecretDraft, nanobotAgentModelDraft, nanobotAgentModelSelectValue, handleSelectNanobotAgentModel, nanobotAgentReasoningEffortDraft, nanobotAgentReasoningOptions, handleSelectNanobotAgentReasoningEffort, nanobotAllowFromDraft, setNanobotAllowFromDraft, handleTestNanobotDingTalk, nanobotTestState, nanobotAwayDetected, nanobotBluetoothState, nanobotBluetoothDevices, onStartNanobotBluetoothScan, onStopNanobotBluetoothScan, nanobotWorkspace, nanobotCodexBinDraft, setNanobotCodexBinDraft, handleCommitNanobotCodexBin, nanobotCodexBinSaving, nanobotCodexBinSavedAt, nanobotEmailImapHostDraft, setNanobotEmailImapHostDraft, nanobotEmailImapPortDraft, setNanobotEmailImapPortDraft, nanobotEmailImapUsernameDraft, setNanobotEmailImapUsernameDraft, nanobotEmailImapPasswordDraft, setNanobotEmailImapPasswordDraft, nanobotEmailImapMailboxDraft, setNanobotEmailImapMailboxDraft, nanobotEmailSmtpHostDraft, setNanobotEmailSmtpHostDraft, nanobotEmailSmtpPortDraft, setNanobotEmailSmtpPortDraft, nanobotEmailSmtpUsernameDraft, setNanobotEmailSmtpUsernameDraft, nanobotEmailSmtpPasswordDraft, setNanobotEmailSmtpPasswordDraft, nanobotEmailFromAddressDraft, setNanobotEmailFromAddressDraft, nanobotEmailPollIntervalDraft, setNanobotEmailPollIntervalDraft, nanobotEmailAllowFromDraft, setNanobotEmailAllowFromDraft, nanobotQqAppIdDraft, setNanobotQqAppIdDraft, nanobotQqSecretDraft, setNanobotQqSecretDraft, nanobotQqAllowFromDraft, setNanobotQqAllowFromDraft, nanobotDirty, handleSaveNanobotSettings, isSavingSettings, handleClearNanobotThreads, nanobotCleanupState, nanobotConfigPath, nanobotConfigPathError, cn }} />
                            <CodexTabSection {...{ t, codexPathDraft, setCodexPathDraft, handleBrowseCodex, codexArgsDraft, setCodexArgsDraft, codexDirty, handleSaveCodexSettings, isSavingSettings, handleRunDoctor, doctorState, projects, codexBinOverrideDrafts, setCodexBinOverrideDrafts, handleCommitCodexBinOverride, codexBinOverrideSaving, codexBinOverrideSavedAt, setCodexBinOverrideSaving, onUpdateWorkspaceCodexBin, setCodexBinOverrideSavedAt, appSettings, handleRunWorkspaceDoctor, codexBinOverrideDoctor, codexHomeOverrideDrafts, setCodexHomeOverrideDrafts, onUpdateWorkspaceSettings, codexArgsOverrideDrafts, setCodexArgsOverrideDrafts, onUpdateAppSettings, remoteHostDraft, setRemoteHostDraft, handleCommitRemoteHost, remoteTokenDraft, setRemoteTokenDraft, handleCommitRemoteToken, globalAgentsMeta, globalAgentsError, globalAgentsContent, globalAgentsLoading, globalAgentsRefreshDisabled, globalAgentsSaveDisabled, globalAgentsSaveLabel, setGlobalAgentsContent, refreshGlobalAgents, saveGlobalAgents, globalConfigMeta, globalConfigError, globalConfigContent, globalConfigLoading, globalConfigRefreshDisabled, globalConfigSaveDisabled, globalConfigSaveLabel, setGlobalConfigContent, refreshGlobalConfig, saveGlobalConfig, normalizeOverrideValue, cn }} />
                            <ExperimentalTabSection {...{ t, hasCodexHomeOverrides, fileManagerLabel, handleOpenConfig, openInFileManagerLabel, openConfigError, appSettings, onUpdateAppSettings, yunyiTokenDraft, setYunyiTokenDraft, handleCommitYunyiToken, happyServerDraft, setHappyServerDraft, handleCommitHappyServer }} />
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
