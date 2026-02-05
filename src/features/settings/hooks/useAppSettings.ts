import { useCallback, useEffect, useState } from "react";
import type { AppSettings } from "../../../types";
import { getAppSettings, runCodexDoctor, updateAppSettings } from "../../../services/tauri";
import { clampUiScale, UI_SCALE_DEFAULT } from "../../../utils/uiScale";
import {
  DEFAULT_CODE_FONT_FAMILY,
  DEFAULT_UI_FONT_FAMILY,
  CODE_FONT_SIZE_DEFAULT,
  clampCodeFontSize,
  normalizeFontFamily,
} from "../../../utils/fonts";
import {
  CUSTOM_NOTIFICATION_SOUND_ID,
  DEFAULT_NOTIFICATION_ERROR_ID,
  DEFAULT_NOTIFICATION_SOUND_VOLUME,
  DEFAULT_NOTIFICATION_SUCCESS_ID,
} from "../../../utils/notificationSoundDefaults";
import { normalizeNotificationSoundId } from "../../../utils/notificationSoundSources";
import {
  DEFAULT_OPEN_APP_ID,
  DEFAULT_OPEN_APP_TARGETS,
  OPEN_APP_STORAGE_KEY,
} from "../../app/constants";
import { normalizeOpenAppTargets } from "../../app/utils/openApp";
import { getDefaultInterruptShortcut } from "../../../utils/shortcuts";

const allowedThemes = new Set(["system", "light", "dark"]);
const allowedThemeColors = new Set([
  "default",
  "blue",
  "green",
  "orange",
  "red",
  "rose",
  "violet",
  "yellow",
]);
const allowedLanguages = new Set(["system", "en", "zh-CN"]);
const allowedComposerSendBehaviors = new Set(["enter", "ctrl-enter", "smart"]);
const DEFAULT_HAPPY_SERVER_URL = "https://api.cluster-fluster.com";

const defaultSettings: AppSettings = {
  codexBin: null,
  codexArgs: null,
  backendMode: "local",
  remoteBackendHost: "127.0.0.1:4732",
  remoteBackendToken: null,
  happyEnabled: false,
  happyServerUrl: DEFAULT_HAPPY_SERVER_URL,
  happyToken: null,
  happySecret: null,
  defaultAccessMode: "current",
  composerModelShortcut: "cmd+shift+m",
  composerAccessShortcut: "cmd+shift+a",
  composerReasoningShortcut: "cmd+shift+r",
  composerCollaborationShortcut: "shift+tab",
  interruptShortcut: getDefaultInterruptShortcut(),
  newAgentShortcut: "cmd+n",
  newWorktreeAgentShortcut: "cmd+shift+n",
  newCloneAgentShortcut: "cmd+alt+n",
  archiveThreadShortcut: "cmd+ctrl+a",
  toggleProjectsSidebarShortcut: "cmd+shift+p",
  toggleGitSidebarShortcut: "cmd+shift+g",
  toggleDebugPanelShortcut: "cmd+shift+d",
  toggleTerminalShortcut: "cmd+shift+t",
  cycleAgentNextShortcut: "cmd+ctrl+down",
  cycleAgentPrevShortcut: "cmd+ctrl+up",
  cycleWorkspaceNextShortcut: "cmd+shift+down",
  cycleWorkspacePrevShortcut: "cmd+shift+up",
  lastComposerModelId: null,
  lastComposerReasoningEffort: null,
  uiScale: UI_SCALE_DEFAULT,
  theme: "system",
  themeColor: "blue",
  language: "system",
  uiFontFamily: DEFAULT_UI_FONT_FAMILY,
  codeFontFamily: DEFAULT_CODE_FONT_FAMILY,
  codeFontSize: CODE_FONT_SIZE_DEFAULT,
  notificationSoundsEnabled: true,
  notificationSoundVolume: DEFAULT_NOTIFICATION_SOUND_VOLUME,
  notificationSoundSuccessVolume: DEFAULT_NOTIFICATION_SOUND_VOLUME,
  notificationSoundErrorVolume: DEFAULT_NOTIFICATION_SOUND_VOLUME,
  notificationSoundSuccessId: DEFAULT_NOTIFICATION_SUCCESS_ID,
  notificationSoundSuccessPath: null,
  notificationSoundErrorId: DEFAULT_NOTIFICATION_ERROR_ID,
  notificationSoundErrorPath: null,
  refreshThreadsOnFocus: false,
  experimentalCollabEnabled: false,
  experimentalCollaborationModesEnabled: false,
  experimentalSteerEnabled: false,
  experimentalUnifiedExecEnabled: false,
  experimentalThreadResumeStreamingEnabled: false,
  experimentalYunyiEnabled: false,
  experimentalYunyiToken: "",
  dictationEnabled: false,
  dictationModelId: "base",
  dictationPreferredLanguage: null,
  dictationHoldKey: "alt",
  composerEditorPreset: "default",
  composerSendBehavior: "enter",
  composerSendConfirmationEnabled: false,
  composerFenceExpandOnSpace: false,
  composerFenceExpandOnEnter: false,
  composerFenceLanguageTags: false,
  composerFenceWrapSelection: false,
  composerFenceAutoWrapPasteMultiline: false,
  composerFenceAutoWrapPasteCodeLike: false,
  composerListContinuation: false,
  composerCodeBlockCopyUseModifier: false,
  workspaceGroups: [],
  openAppTargets: DEFAULT_OPEN_APP_TARGETS,
  selectedOpenAppId: DEFAULT_OPEN_APP_ID,
};

function normalizeAppSettings(settings: AppSettings): AppSettings {
  const normalizedTargets =
    settings.openAppTargets && settings.openAppTargets.length
      ? normalizeOpenAppTargets(settings.openAppTargets)
      : DEFAULT_OPEN_APP_TARGETS;
  const storedOpenAppId =
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem(OPEN_APP_STORAGE_KEY);
  const hasPersistedSelection = normalizedTargets.some(
    (target) => target.id === settings.selectedOpenAppId,
  );
  const hasStoredSelection =
    !hasPersistedSelection &&
    storedOpenAppId !== null &&
    normalizedTargets.some((target) => target.id === storedOpenAppId);
  const selectedOpenAppId = hasPersistedSelection
    ? settings.selectedOpenAppId
    : hasStoredSelection
      ? storedOpenAppId
      : normalizedTargets[0]?.id ?? DEFAULT_OPEN_APP_ID;
  const normalizedSuccessId =
    normalizeNotificationSoundId(settings.notificationSoundSuccessId) ??
    DEFAULT_NOTIFICATION_SUCCESS_ID;
  const normalizedSuccessPath =
    normalizedSuccessId === CUSTOM_NOTIFICATION_SOUND_ID &&
    settings.notificationSoundSuccessPath?.trim()
      ? settings.notificationSoundSuccessPath.trim()
      : null;
  const normalizedErrorId =
    normalizeNotificationSoundId(settings.notificationSoundErrorId) ??
    DEFAULT_NOTIFICATION_ERROR_ID;
  const normalizedErrorPath =
    normalizedErrorId === CUSTOM_NOTIFICATION_SOUND_ID &&
    settings.notificationSoundErrorPath?.trim()
      ? settings.notificationSoundErrorPath.trim()
      : null;

  return {
    ...settings,
    codexBin: settings.codexBin?.trim() ? settings.codexBin.trim() : null,
    codexArgs: settings.codexArgs?.trim() ? settings.codexArgs.trim() : null,
    happyServerUrl:
      settings.happyServerUrl?.trim() || DEFAULT_HAPPY_SERVER_URL,
    happyToken: settings.happyToken?.trim() ? settings.happyToken.trim() : null,
    happySecret: settings.happySecret?.trim() ? settings.happySecret.trim() : null,
    uiScale: clampUiScale(settings.uiScale),
    theme: allowedThemes.has(settings.theme) ? settings.theme : "system",
    themeColor: allowedThemeColors.has(settings.themeColor)
      ? settings.themeColor
      : "blue",
    language: allowedLanguages.has(settings.language) ? settings.language : "system",
    uiFontFamily: normalizeFontFamily(
      settings.uiFontFamily,
      DEFAULT_UI_FONT_FAMILY,
    ),
    codeFontFamily: normalizeFontFamily(
      settings.codeFontFamily,
      DEFAULT_CODE_FONT_FAMILY,
    ),
    codeFontSize: clampCodeFontSize(settings.codeFontSize),
    dictationHoldKey:
      settings.dictationHoldKey && settings.dictationHoldKey.trim()
        ? settings.dictationHoldKey.trim()
        : null,
    notificationSoundVolume:
      typeof settings.notificationSoundVolume === "number" &&
      Number.isFinite(settings.notificationSoundVolume)
        ? Math.min(1, Math.max(0, settings.notificationSoundVolume))
        : DEFAULT_NOTIFICATION_SOUND_VOLUME,
    notificationSoundSuccessVolume: (() => {
      const legacyVolume =
        typeof settings.notificationSoundVolume === "number" &&
        Number.isFinite(settings.notificationSoundVolume)
          ? Math.min(1, Math.max(0, settings.notificationSoundVolume))
          : null;
      const volume =
        typeof settings.notificationSoundSuccessVolume === "number" &&
        Number.isFinite(settings.notificationSoundSuccessVolume)
          ? Math.min(1, Math.max(0, settings.notificationSoundSuccessVolume))
          : legacyVolume;
      return volume ?? DEFAULT_NOTIFICATION_SOUND_VOLUME;
    })(),
    notificationSoundErrorVolume: (() => {
      const legacyVolume =
        typeof settings.notificationSoundVolume === "number" &&
        Number.isFinite(settings.notificationSoundVolume)
          ? Math.min(1, Math.max(0, settings.notificationSoundVolume))
          : null;
      const volume =
        typeof settings.notificationSoundErrorVolume === "number" &&
        Number.isFinite(settings.notificationSoundErrorVolume)
          ? Math.min(1, Math.max(0, settings.notificationSoundErrorVolume))
          : legacyVolume;
      return volume ?? DEFAULT_NOTIFICATION_SOUND_VOLUME;
    })(),
    notificationSoundSuccessId:
      normalizedSuccessId === CUSTOM_NOTIFICATION_SOUND_ID &&
      !normalizedSuccessPath
        ? DEFAULT_NOTIFICATION_SUCCESS_ID
        : normalizedSuccessId,
    notificationSoundSuccessPath:
      normalizedSuccessId === CUSTOM_NOTIFICATION_SOUND_ID
        ? normalizedSuccessPath
        : null,
    notificationSoundErrorId:
      normalizedErrorId === CUSTOM_NOTIFICATION_SOUND_ID && !normalizedErrorPath
        ? DEFAULT_NOTIFICATION_ERROR_ID
        : normalizedErrorId,
    notificationSoundErrorPath:
      normalizedErrorId === CUSTOM_NOTIFICATION_SOUND_ID
        ? normalizedErrorPath
        : null,
    refreshThreadsOnFocus: Boolean(settings.refreshThreadsOnFocus),
    experimentalYunyiToken: settings.experimentalYunyiToken?.trim() ?? "",
    composerSendBehavior: allowedComposerSendBehaviors.has(
      settings.composerSendBehavior,
    )
      ? settings.composerSendBehavior
      : "enter",
    openAppTargets: normalizedTargets,
    selectedOpenAppId,
  };
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await getAppSettings();
        if (active) {
          setSettings(
            normalizeAppSettings({
              ...defaultSettings,
              ...response,
            }),
          );
        }
      } catch {
        // Defaults stay in place if loading settings fails.
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const saveSettings = useCallback(async (next: AppSettings) => {
    const normalized = normalizeAppSettings(next);
    const saved = await updateAppSettings(normalized);
    setSettings(
      normalizeAppSettings({
        ...defaultSettings,
        ...saved,
      }),
    );
    return saved;
  }, []);

  const doctor = useCallback(
    async (codexBin: string | null, codexArgs: string | null) => {
      return runCodexDoctor(codexBin, codexArgs);
    },
    [],
  );

  return {
    settings,
    setSettings,
    saveSettings,
    doctor,
    isLoading,
  };
}
