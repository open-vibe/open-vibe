import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles/base.css";
import "./styles/globals.css";
import "./styles/buttons.css";
import "./styles/sidebar.css";
import "./styles/workspace-home.css";
import "./styles/main.css";
import "./styles/messages.css";
import "./styles/approval-toasts.css";
import "./styles/error-toasts.css";
import "./styles/request-user-input.css";
import "./styles/update-toasts.css";
import "./styles/composer.css";
import "./styles/diff.css";
import "./styles/diff-viewer.css";
import "./styles/file-tree.css";
import "./styles/panel-tabs.css";
import "./styles/prompts.css";
import "./styles/debug.css";
import "./styles/terminal.css";
import "./styles/plan.css";
import "./styles/about.css";
import "./styles/tabbar.css";
import "./styles/worktree-modal.css";
import "./styles/clone-modal.css";
import "./styles/compact-base.css";
import "./styles/compact-phone.css";
import "./styles/compact-tablet.css";
import "./styles/yunyi-card.css";
import "./styles/thread-tabs.css";
import {
  defaultNotificationErrorSoundUrl,
  defaultNotificationSuccessSoundUrl,
  resolveNotificationSoundUrl,
} from "./utils/notificationSoundSources";
import { DEFAULT_NOTIFICATION_SOUND_VOLUME } from "./utils/notificationSoundDefaults";
import { AppLayout } from "./features/app/components/AppLayout";
import { AppModals } from "./features/app/components/AppModals";
import { MainHeaderActions } from "./features/app/components/MainHeaderActions";
import { useLayoutNodes } from "./features/layout/hooks/useLayoutNodes";
import { useWorkspaceDropZone } from "./features/workspaces/hooks/useWorkspaceDropZone";
import { useThreads } from "./features/threads/hooks/useThreads";
import { useWindowDrag } from "./features/layout/hooks/useWindowDrag";
import { useGitPanelController } from "./features/app/hooks/useGitPanelController";
import { useGitRemote } from "./features/git/hooks/useGitRemote";
import { useGitRepoScan } from "./features/git/hooks/useGitRepoScan";
import { usePullRequestComposer } from "./features/git/hooks/usePullRequestComposer";
import { useGitActions } from "./features/git/hooks/useGitActions";
import { useAutoExitEmptyDiff } from "./features/git/hooks/useAutoExitEmptyDiff";
import { useModels } from "./features/models/hooks/useModels";
import { useCollaborationModes } from "./features/collaboration/hooks/useCollaborationModes";
import { useCollaborationModeSelection } from "./features/collaboration/hooks/useCollaborationModeSelection";
import { useSkills } from "./features/skills/hooks/useSkills";
import { useCustomPrompts } from "./features/prompts/hooks/useCustomPrompts";
import { useWorkspaceFiles } from "./features/workspaces/hooks/useWorkspaceFiles";
import { useGitBranches } from "./features/git/hooks/useGitBranches";
import { useDebugLog } from "./features/debug/hooks/useDebugLog";
import { useWorkspaceRefreshOnFocus } from "./features/workspaces/hooks/useWorkspaceRefreshOnFocus";
import { useWorkspaceRestore } from "./features/workspaces/hooks/useWorkspaceRestore";
import { useRenameWorktreePrompt } from "./features/workspaces/hooks/useRenameWorktreePrompt";
import { useLayoutController } from "./features/app/hooks/useLayoutController";
import { useWindowLabel } from "./features/layout/hooks/useWindowLabel";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAppSettingsController } from "./features/app/hooks/useAppSettingsController";
import { useUpdaterController } from "./features/app/hooks/useUpdaterController";
import { useErrorToasts } from "./features/notifications/hooks/useErrorToasts";
import { useComposerShortcuts } from "./features/composer/hooks/useComposerShortcuts";
import { useComposerMenuActions } from "./features/composer/hooks/useComposerMenuActions";
import { useComposerEditorState } from "./features/composer/hooks/useComposerEditorState";
import { useDictationController } from "./features/app/hooks/useDictationController";
import { useComposerController } from "./features/app/hooks/useComposerController";
import { useComposerInsert } from "./features/app/hooks/useComposerInsert";
import { useRenameThreadPrompt } from "./features/threads/hooks/useRenameThreadPrompt";
import { useWorktreePrompt } from "./features/workspaces/hooks/useWorktreePrompt";
import { useClonePrompt } from "./features/workspaces/hooks/useClonePrompt";
import { useWorkspaceController } from "./features/app/hooks/useWorkspaceController";
import { useWorkspaceSelection } from "./features/workspaces/hooks/useWorkspaceSelection";
import { useLocalUsage } from "./features/home/hooks/useLocalUsage";
import { useGitHubPanelController } from "./features/app/hooks/useGitHubPanelController";
import { useHappyBridgeEvents } from "./features/happy/hooks/useHappyBridgeEvents";
import { useNanobotBridgeEvents } from "./features/nanobot/hooks/useNanobotBridgeEvents";
import { useNanobotMonitor } from "./features/nanobot/hooks/useNanobotMonitor";
import { useSettingsModalState } from "./features/app/hooks/useSettingsModalState";
import { usePersistComposerSettings } from "./features/app/hooks/usePersistComposerSettings";
import { isMissingGitRepoError } from "./utils/gitErrors";
import { I18nProvider, getTranslator } from "./i18n";
import { useSyncSelectedDiffPath } from "./features/app/hooks/useSyncSelectedDiffPath";
import { useMenuAcceleratorController } from "./features/app/hooks/useMenuAcceleratorController";
import { useAppMenuEvents } from "./features/app/hooks/useAppMenuEvents";
import { useWorkspaceActions } from "./features/app/hooks/useWorkspaceActions";
import { useWorkspaceCycling } from "./features/app/hooks/useWorkspaceCycling";
import { useStickyRateLimits } from "./features/app/hooks/useStickyRateLimits";
import { useThreadRows } from "./features/app/hooks/useThreadRows";
import { useInterruptShortcut } from "./features/app/hooks/useInterruptShortcut";
import { useArchiveShortcut } from "./features/app/hooks/useArchiveShortcut";
import { useLiquidGlassEffect } from "./features/app/hooks/useLiquidGlassEffect";
import { useCopyThread } from "./features/threads/hooks/useCopyThread";
import { useTerminalController } from "./features/terminal/hooks/useTerminalController";
import { useWorkspaceLaunchScript } from "./features/app/hooks/useWorkspaceLaunchScript";
import { useWorktreeSetupScript } from "./features/app/hooks/useWorktreeSetupScript";
import { useGitCommitController } from "./features/app/hooks/useGitCommitController";
import { WorkspaceHome } from "./features/workspaces/components/WorkspaceHome";
import { useWorkspaceHome } from "./features/workspaces/hooks/useWorkspaceHome";
import { useWorkspaceAgentMd } from "./features/workspaces/hooks/useWorkspaceAgentMd";
import {
  getNanobotConfigPath,
  pickWorkspacePath,
  testNanobotDingTalk,
} from "./services/tauri";
import { ThreadTabsBar } from "./features/app/components/ThreadTabsBar";
import { ThreadTabsContent } from "./features/app/components/ThreadTabsContent";
import { useThreadTabs, type ThreadTab } from "./features/app/hooks/useThreadTabs";
import type { ThreadTopbarOverrides } from "./features/app/types/threadTabs";
import { DebugErrorBoundary } from "./features/app/components/DebugErrorBoundary";
import type {
  AccessMode,
  ComposerEditorSettings,
  ThemeColor,
  ThemePreference,
  WorkspaceInfo,
} from "./types";
import { OPEN_APP_STORAGE_KEY } from "./features/app/constants";
import { useOpenAppIcons } from "./features/app/hooks/useOpenAppIcons";

const AboutView = lazy(() =>
  import("./features/about/components/AboutView").then((module) => ({
    default: module.AboutView,
  })),
);

const SettingsView = lazy(() =>
  import("./features/settings/components/SettingsView").then((module) => ({
    default: module.SettingsView,
  })),
);

const GitHubPanelData = lazy(() =>
  import("./features/git/components/GitHubPanelData").then((module) => ({
    default: module.GitHubPanelData,
  })),
);


function MainApp() {
  const {
    appSettings,
    setAppSettings,
    doctor,
    appSettingsLoading,
    reduceTransparency,
    setReduceTransparency,
    scaleShortcutTitle,
    scaleShortcutText,
    queueSaveSettings,
  } = useAppSettingsController();
  const {
    dictationModel,
    dictationState,
    dictationLevel,
    dictationTranscript,
    dictationError,
    dictationHint,
    dictationReady,
    handleToggleDictation,
    clearDictationTranscript,
    clearDictationError,
    clearDictationHint,
  } = useDictationController(appSettings);
  const {
    debugOpen,
    setDebugOpen,
    debugEntries,
    showDebugButton,
    addDebugEntry,
    handleCopyDebug,
    clearDebugEntries,
  } = useDebugLog();
  useLiquidGlassEffect({ reduceTransparency, onDebug: addDebugEntry });
  const [accessMode, setAccessMode] = useState<AccessMode>("current");
  const [activeTab, setActiveTab] = useState<
    "projects" | "codex" | "git" | "log"
  >("codex");
  const [logPanelMode, setLogPanelMode] = useState<"debug" | "nanobot">(
    "debug",
  );
  const [homeView, setHomeView] = useState(true);
  const tabletTab = activeTab === "projects" ? "codex" : activeTab;
  const {
    workspaces,
    workspaceGroups,
    groupedWorkspaces,
    getWorkspaceGroupName,
    ungroupedLabel,
    activeWorkspace,
    activeWorkspaceId,
    setActiveWorkspaceId,
    addWorkspace,
    addWorkspaceFromPath,
    addCloneAgent,
    addWorktreeAgent,
    connectWorkspace,
    reconnectWorkspace,
    markWorkspaceConnected,
    updateWorkspaceSettings,
    updateWorkspaceCodexBin,
    createWorkspaceGroup,
    renameWorkspaceGroup,
    moveWorkspaceGroup,
    deleteWorkspaceGroup,
    assignWorkspaceGroup,
    removeWorkspace,
    removeWorktree,
    renameWorktree,
    renameWorktreeUpstream,
    deletingWorktreeIds,
    hasLoaded,
    refreshWorkspaces,
  } = useWorkspaceController({
    appSettings,
    addDebugEntry,
    queueSaveSettings,
  });
  const workspacesById = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace])),
    [workspaces],
  );
  const {
    sidebarWidth,
    rightPanelWidth,
    onSidebarResizeStart,
    onRightPanelResizeStart,
    planPanelHeight,
    onPlanPanelResizeStart,
    terminalPanelHeight,
    onTerminalPanelResizeStart,
    debugPanelHeight,
    onDebugPanelResizeStart,
    isCompact,
    isTablet,
    isPhone,
    sidebarCollapsed,
    rightPanelCollapsed,
    collapseSidebar,
    expandSidebar,
    collapseRightPanel,
    expandRightPanel,
    terminalOpen,
    handleToggleTerminal,
    openTerminal,
    closeTerminal: closeTerminalPanel,
  } = useLayoutController({
    activeWorkspaceId,
    setActiveTab,
    setDebugOpen,
    toggleDebugPanelShortcut: appSettings.toggleDebugPanelShortcut,
    toggleTerminalShortcut: appSettings.toggleTerminalShortcut,
  });
  const sidebarToggleProps = {
    isCompact,
    sidebarCollapsed,
    rightPanelCollapsed,
    onCollapseSidebar: collapseSidebar,
    onExpandSidebar: expandSidebar,
    onCollapseRightPanel: collapseRightPanel,
    onExpandRightPanel: expandRightPanel,
  };
  const {
    settingsOpen,
    settingsSection,
    openSettings,
    closeSettings,
  } = useSettingsModalState();
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const notificationSoundSuccessVolume =
    typeof appSettings.notificationSoundSuccessVolume === "number" &&
    Number.isFinite(appSettings.notificationSoundSuccessVolume)
      ? appSettings.notificationSoundSuccessVolume
      : DEFAULT_NOTIFICATION_SOUND_VOLUME;
  const notificationSoundErrorVolume =
    typeof appSettings.notificationSoundErrorVolume === "number" &&
    Number.isFinite(appSettings.notificationSoundErrorVolume)
      ? appSettings.notificationSoundErrorVolume
      : DEFAULT_NOTIFICATION_SOUND_VOLUME;
  const notificationSuccessSoundUrl = useMemo(
    () =>
      resolveNotificationSoundUrl({
        soundId: appSettings.notificationSoundSuccessId,
        soundPath: appSettings.notificationSoundSuccessPath,
        fallbackUrl: defaultNotificationSuccessSoundUrl,
      }),
    [
      appSettings.notificationSoundSuccessId,
      appSettings.notificationSoundSuccessPath,
    ],
  );
  const notificationErrorSoundUrl = useMemo(
    () =>
      resolveNotificationSoundUrl({
        soundId: appSettings.notificationSoundErrorId,
        soundPath: appSettings.notificationSoundErrorPath,
        fallbackUrl: defaultNotificationErrorSoundUrl,
      }),
    [
      appSettings.notificationSoundErrorId,
      appSettings.notificationSoundErrorPath,
    ],
  );

  const {
    updaterState,
    startUpdate,
    dismissUpdate,
    handleTestNotificationSound,
  } = useUpdaterController({
    notificationSoundsEnabled: appSettings.notificationSoundsEnabled,
    notificationSoundSuccessVolume,
    notificationSoundErrorVolume,
    onDebug: addDebugEntry,
    successSoundUrl: notificationSuccessSoundUrl,
    errorSoundUrl: notificationErrorSoundUrl,
  });

  const { errorToasts, dismissErrorToast } = useErrorToasts();
  const t = useMemo(
    () => getTranslator(appSettings.language),
    [appSettings.language],
  );
  const logPanelTitle =
    logPanelMode === "nanobot" ? t("log.nanobot.title") : t("log.debug.title");
  const logPanelEmptyText =
    logPanelMode === "nanobot" ? t("log.nanobot.empty") : t("log.debug.empty");
  const debugLogTitle = t("log.debug.title");
  const nanobotLogTitle = t("log.nanobot.title");
  const debugLogEmptyText = t("log.debug.empty");
  const nanobotLogEmptyText = t("log.nanobot.empty");

  useEffect(() => {
    setAccessMode((prev) =>
      prev === "current" ? appSettings.defaultAccessMode : prev
    );
  }, [appSettings.defaultAccessMode]);

  const {
    gitIssues,
    gitIssuesTotal,
    gitIssuesLoading,
    gitIssuesError,
    gitPullRequests,
    gitPullRequestsTotal,
    gitPullRequestsLoading,
    gitPullRequestsError,
    gitPullRequestDiffs,
    gitPullRequestDiffsLoading,
    gitPullRequestDiffsError,
    gitPullRequestComments,
    gitPullRequestCommentsLoading,
    gitPullRequestCommentsError,
    handleGitIssuesChange,
    handleGitPullRequestsChange,
    handleGitPullRequestDiffsChange,
    handleGitPullRequestCommentsChange,
    resetGitHubPanelState,
  } = useGitHubPanelController();

  const {
    centerMode,
    setCenterMode,
    selectedDiffPath,
    setSelectedDiffPath,
    diffScrollRequestId,
    gitPanelMode,
    setGitPanelMode,
    gitDiffViewStyle,
    setGitDiffViewStyle,
    filePanelMode,
    setFilePanelMode,
    selectedPullRequest,
    setSelectedPullRequest,
    selectedCommitSha,
    setSelectedCommitSha,
    diffSource,
    setDiffSource,
    gitStatus,
    refreshGitStatus,
    queueGitStatusRefresh,
    refreshGitDiffs,
    gitLogEntries,
    gitLogTotal,
    gitLogAhead,
    gitLogBehind,
    gitLogAheadEntries,
    gitLogBehindEntries,
    gitLogUpstream,
    gitLogLoading,
    gitLogError,
    refreshGitLog,
    gitCommitDiffs,
    shouldLoadDiffs,
    activeDiffs,
    activeDiffLoading,
    activeDiffError,
    handleSelectDiff,
    handleSelectCommit,
    handleActiveDiffPath,
    handleGitPanelModeChange,
    activeWorkspaceIdRef,
    activeWorkspaceRef,
  } = useGitPanelController({
    activeWorkspace,
    isCompact,
    isTablet,
    activeTab,
    tabletTab,
    setActiveTab,
    prDiffs: gitPullRequestDiffs,
    prDiffsLoading: gitPullRequestDiffsLoading,
    prDiffsError: gitPullRequestDiffsError,
  });

  const shouldLoadGitHubPanelData =
    gitPanelMode === "issues" ||
    gitPanelMode === "prs" ||
    (shouldLoadDiffs && diffSource === "pr");

  useEffect(() => {
    resetGitHubPanelState();
  }, [activeWorkspaceId, resetGitHubPanelState]);
  const { remote: gitRemoteUrl } = useGitRemote(activeWorkspace);
  const {
    repos: gitRootCandidates,
    isLoading: gitRootScanLoading,
    error: gitRootScanError,
    depth: gitRootScanDepth,
    hasScanned: gitRootScanHasScanned,
    scan: scanGitRoots,
    setDepth: setGitRootScanDepth,
    clear: clearGitRootCandidates,
  } = useGitRepoScan(activeWorkspace);
  const {
    models,
    selectedModel,
    selectedModelId,
    setSelectedModelId,
    reasoningSupported,
    reasoningOptions,
    selectedEffort,
    setSelectedEffort
  } = useModels({
    activeWorkspace,
    onDebug: addDebugEntry,
    preferredModelId: appSettings.lastComposerModelId,
    preferredEffort: appSettings.lastComposerReasoningEffort,
  });

  const {
    collaborationModes,
    selectedCollaborationMode,
    selectedCollaborationModeId,
    setSelectedCollaborationModeId,
  } = useCollaborationModes({
    activeWorkspace,
    enabled: appSettings.experimentalCollaborationModesEnabled,
    onDebug: addDebugEntry,
  });

  useComposerShortcuts({
    textareaRef: composerInputRef,
    modelShortcut: appSettings.composerModelShortcut,
    accessShortcut: appSettings.composerAccessShortcut,
    reasoningShortcut: appSettings.composerReasoningShortcut,
    collaborationShortcut: appSettings.experimentalCollaborationModesEnabled
      ? appSettings.composerCollaborationShortcut
      : null,
    models,
    collaborationModes,
    selectedModelId,
    onSelectModel: setSelectedModelId,
    selectedCollaborationModeId,
    onSelectCollaborationMode: setSelectedCollaborationModeId,
    accessMode,
    onSelectAccessMode: setAccessMode,
    reasoningOptions,
    selectedEffort,
    onSelectEffort: setSelectedEffort,
    reasoningSupported,
  });

  useComposerMenuActions({
    models,
    selectedModelId,
    onSelectModel: setSelectedModelId,
    collaborationModes,
    selectedCollaborationModeId,
    onSelectCollaborationMode: setSelectedCollaborationModeId,
    accessMode,
    onSelectAccessMode: setAccessMode,
    reasoningOptions,
    selectedEffort,
    onSelectEffort: setSelectedEffort,
    reasoningSupported,
    onFocusComposer: () => composerInputRef.current?.focus(),
  });
  const { skills } = useSkills({ activeWorkspace, onDebug: addDebugEntry });
  const {
    prompts,
    createPrompt,
    updatePrompt,
    deletePrompt,
    movePrompt,
    getWorkspacePromptsDir,
    getGlobalPromptsDir,
  } = useCustomPrompts({ activeWorkspace, onDebug: addDebugEntry });
  const { files, isLoading: isFilesLoading } = useWorkspaceFiles({
    activeWorkspace,
    onDebug: addDebugEntry,
  });
  const { branches, checkoutBranch, createBranch } = useGitBranches({
    activeWorkspace,
    onDebug: addDebugEntry
  });
  const handleCheckoutBranch = async (name: string) => {
    await checkoutBranch(name);
    refreshGitStatus();
  };
  const handleCreateBranch = async (name: string) => {
    await createBranch(name);
    refreshGitStatus();
  };
  const alertError = useCallback((error: unknown) => {
    alert(error instanceof Error ? error.message : String(error));
  }, []);
  const {
    applyWorktreeChanges: handleApplyWorktreeChanges,
    revertAllGitChanges: handleRevertAllGitChanges,
    revertGitFile: handleRevertGitFile,
    stageGitAll: handleStageGitAll,
    stageGitFile: handleStageGitFile,
    unstageGitFile: handleUnstageGitFile,
    worktreeApplyError,
    worktreeApplyLoading,
    worktreeApplySuccess,
  } = useGitActions({
    activeWorkspace,
    onRefreshGitStatus: refreshGitStatus,
    onRefreshGitDiffs: refreshGitDiffs,
    onError: alertError,
  });

  const resolvedModel = selectedModel?.model ?? null;
  const resolvedEffort = reasoningSupported ? selectedEffort : null;
  const activeGitRoot = activeWorkspace?.settings.gitRoot ?? null;
  const normalizePath = useCallback((value: string) => {
    return value.replace(/\\/g, "/").replace(/\/+$/, "");
  }, []);
  const handleSetGitRoot = useCallback(
    async (path: string | null) => {
      if (!activeWorkspace) {
        return;
      }
      await updateWorkspaceSettings(activeWorkspace.id, {
        gitRoot: path,
      });
      clearGitRootCandidates();
      refreshGitStatus();
    },
    [
      activeWorkspace,
      clearGitRootCandidates,
      refreshGitStatus,
      updateWorkspaceSettings,
    ],
  );
  const handlePickGitRoot = useCallback(async () => {
    if (!activeWorkspace) {
      return;
    }
    const selection = await pickWorkspacePath();
    if (!selection) {
      return;
    }
    const workspacePath = normalizePath(activeWorkspace.path);
    const selectedPath = normalizePath(selection);
    let nextRoot: string | null = null;
    if (selectedPath === workspacePath) {
      nextRoot = null;
    } else if (selectedPath.startsWith(`${workspacePath}/`)) {
      nextRoot = selectedPath.slice(workspacePath.length + 1);
    } else {
      nextRoot = selectedPath;
    }
    await handleSetGitRoot(nextRoot);
  }, [activeWorkspace, handleSetGitRoot, normalizePath]);
  const fileStatus = gitStatus.error
    ? isMissingGitRepoError(gitStatus.error)
      ? t("git.status.noRepo")
      : t("git.status.unavailable")
    : gitStatus.files.length > 0
      ? t(
          gitStatus.files.length === 1
            ? "git.status.changed.one"
            : "git.status.changed.other",
          { count: gitStatus.files.length },
        )
      : t("git.status.clean");

  usePersistComposerSettings({
    appSettingsLoading,
    selectedModelId,
    selectedEffort,
    setAppSettings,
    queueSaveSettings,
  });

  const { isExpanded: composerEditorExpanded, toggleExpanded: toggleComposerEditorExpanded } =
    useComposerEditorState();

  const composerEditorSettings = useMemo<ComposerEditorSettings>(
    () => ({
      preset: appSettings.composerEditorPreset,
      expandFenceOnSpace: appSettings.composerFenceExpandOnSpace,
      expandFenceOnEnter: appSettings.composerFenceExpandOnEnter,
      fenceLanguageTags: appSettings.composerFenceLanguageTags,
      fenceWrapSelection: appSettings.composerFenceWrapSelection,
      autoWrapPasteMultiline: appSettings.composerFenceAutoWrapPasteMultiline,
      autoWrapPasteCodeLike: appSettings.composerFenceAutoWrapPasteCodeLike,
      continueListOnShiftEnter: appSettings.composerListContinuation,
    }),
    [
      appSettings.composerEditorPreset,
      appSettings.composerFenceExpandOnSpace,
      appSettings.composerFenceExpandOnEnter,
      appSettings.composerFenceLanguageTags,
      appSettings.composerFenceWrapSelection,
      appSettings.composerFenceAutoWrapPasteMultiline,
      appSettings.composerFenceAutoWrapPasteCodeLike,
      appSettings.composerListContinuation,
    ],
  );


  useSyncSelectedDiffPath({
    diffSource,
    centerMode,
    gitPullRequestDiffs,
    gitCommitDiffs,
    selectedDiffPath,
    setSelectedDiffPath,
  });

  const { collaborationModePayload } = useCollaborationModeSelection({
    selectedCollaborationMode,
    selectedCollaborationModeId,
    selectedEffort: resolvedEffort,
    resolvedModel,
  });

  const happyEnabled =
    appSettings.happyEnabled &&
    Boolean(appSettings.happyToken?.trim()) &&
    Boolean(appSettings.happySecret?.trim());
  const nanobotEnabled = appSettings.nanobotEnabled;
  const {
    snapshot: nanobotStatusSnapshot,
    logEntries: nanobotLogEntries,
    clearLogEntries: clearNanobotLogEntries,
    copyLogEntries: copyNanobotLogEntries,
  } = useNanobotMonitor({
    enabled: appSettings.nanobotEnabled,
    mode: appSettings.nanobotMode,
    dingtalkEnabled: appSettings.nanobotDingTalkEnabled,
    emailEnabled: appSettings.nanobotEmailEnabled,
    qqEnabled: appSettings.nanobotQqEnabled,
  });
  const getWorkspacePath = useCallback(
    (workspaceId: string) =>
      workspaces.find((workspace) => workspace.id === workspaceId)?.path ??
      null,
    [workspaces],
  );

  const {
    setActiveThreadId,
    activeThreadId,
    activeItems,
    itemsByThread,
    approvals,
    userInputRequests,
    threadsByWorkspace,
    threadParentById,
    threadStatusById,
    threadListLoadingByWorkspace,
    threadListPagingByWorkspace,
    threadListCursorByWorkspace,
    tokenUsageByThread,
    rateLimitsByWorkspace,
    planByThread,
    lastAgentMessageByThread,
    happyMessageStatusById,
    happyMessageIdByItemId,
    happyConnected,
    interruptTurn,
    removeThread,
    pinThread,
    unpinThread,
    isThreadPinned,
    getPinTimestamp,
    renameThread,
    startThreadForWorkspace,
    listThreadsForWorkspace,
    loadOlderThreadsForWorkspace,
    resetWorkspaceThreads,
    refreshThread,
    sendUserMessage,
    sendUserMessageToThread,
    retryHappyMessage,
    startReview,
    handleApprovalDecision,
    handleApprovalRemember,
    handleUserInputSubmit,
    getWorkspaceIdForThread,
  } = useThreads({
    activeWorkspace,
    onWorkspaceConnected: markWorkspaceConnected,
    onDebug: addDebugEntry,
    model: resolvedModel,
    effort: resolvedEffort,
    collaborationMode: collaborationModePayload,
    accessMode,
    steerEnabled: appSettings.experimentalSteerEnabled,
    resumeStreamingEnabled: appSettings.experimentalThreadResumeStreamingEnabled,
    customPrompts: prompts,
    onMessageActivity: queueGitStatusRefresh,
    happyEnabled,
    nanobotBridgeEnabled: nanobotEnabled,
    getWorkspacePath,
  });
  const activeThreadIdRef = useRef<string | null>(activeThreadId ?? null);
  const { getThreadRows } = useThreadRows(threadParentById);
  useEffect(() => {
    activeThreadIdRef.current = activeThreadId ?? null;
  }, [activeThreadId]);

  const {
    tabs: threadTabs,
    activeTabId: activeThreadTabId,
    setActiveTab: setActiveThreadTabId,
    openTab: openThreadTab,
    openWorkspaceTab,
    openHomeTab,
    openDebugLogTab,
    openNanobotLogTab,
    closeTab: closeThreadTab,
    markTabLoaded,
    reorderTabs: reorderThreadTabs,
  } = useThreadTabs({
    workspaces,
    threadsByWorkspace,
    homeTabTitle: t("sidebar.home"),
    debugLogTabTitle: debugLogTitle,
    nanobotLogTabTitle: nanobotLogTitle,
  });
  const openThreadIds = useMemo(
    () =>
      new Set(
        threadTabs
          .filter(
            (tab): tab is ThreadTab & { kind: "thread"; threadId: string } =>
              tab.kind === "thread",
          )
          .map((tab) => `${tab.workspaceId}:${tab.threadId}`),
      ),
    [threadTabs],
  );
  const handleOpenDebugLog = useCallback(() => {
    setLogPanelMode("debug");
    if (isCompact) {
      setActiveTab("log");
      return;
    }
    setDebugOpen(false);
    setHomeView(false);
    openDebugLogTab(debugLogTitle);
  }, [
    debugLogTitle,
    isCompact,
    openDebugLogTab,
    setActiveTab,
    setDebugOpen,
  ]);
  const handleOpenNanobotLog = useCallback(() => {
    setLogPanelMode("nanobot");
    if (isCompact) {
      setActiveTab("log");
      return;
    }
    setDebugOpen(false);
    setHomeView(false);
    openNanobotLogTab(nanobotLogTitle);
  }, [
    isCompact,
    nanobotLogTitle,
    openNanobotLogTab,
    setActiveTab,
    setDebugOpen,
  ]);
  useHappyBridgeEvents({
    enabled: happyEnabled,
    workspaces,
    getWorkspaceIdForThread,
    sendUserMessageToThread,
  });
  useNanobotBridgeEvents({
    enabled: nanobotEnabled,
    defaultMode: appSettings.nanobotMode,
    workspaces,
    activeWorkspaceId,
    openThreadTabs: threadTabs,
    t,
    connectWorkspace,
    startThreadForWorkspace,
    sendUserMessageToThread,
  });
  const closedThreadTabIdsRef = useRef<Set<string>>(new Set());
  const selectHomeRef = useRef<() => void>(() => {});
  const makeThreadTabId = useCallback(
    (workspaceId: string, threadId: string) => `${workspaceId}:${threadId}`,
    [],
  );

  const activeThreadTab = useMemo(
    () =>
      activeThreadTabId
        ? threadTabs.find((tab) => tab.id === activeThreadTabId) ?? null
        : null,
    [activeThreadTabId, threadTabs],
  );
  const activeThreadName = useMemo(() => {
    if (!activeWorkspaceId || !activeThreadId) {
      return null;
    }
    const resolved =
      threadsByWorkspace[activeWorkspaceId]?.find(
        (thread) => thread.id === activeThreadId,
      )?.name ?? activeThreadTab?.title ?? null;
    return resolved ?? `Agent ${activeThreadId.slice(0, 4)}`;
  }, [activeThreadId, activeThreadTab?.title, activeWorkspaceId, threadsByWorkspace]);
  const composerTargetLabel = useMemo(() => {
    if (!activeWorkspace || !activeThreadName) {
      return null;
    }
    return `${activeWorkspace.name} / ${activeThreadName}`;
  }, [activeThreadName, activeWorkspace]);

  useEffect(() => {
    if (!activeThreadTab || homeView) {
      return;
    }
    if (activeThreadTab.kind === "home") {
      setActiveThreadId(null);
      setHomeView(true);
      selectHomeRef.current();
      if (!activeThreadTab.loaded) {
        markTabLoaded(activeThreadTab.id);
      }
      return;
    }
    if (activeThreadTab.kind === "workspace") {
      if (activeWorkspaceId !== activeThreadTab.workspaceId) {
        setActiveWorkspaceId(activeThreadTab.workspaceId);
      }
      if (activeThreadId !== null || activeWorkspaceId !== activeThreadTab.workspaceId) {
        setActiveThreadId(null, activeThreadTab.workspaceId);
      }
      if (!activeThreadTab.loaded) {
        markTabLoaded(activeThreadTab.id);
      }
      return;
    }
    if (
      activeThreadTab.kind === "debug-log" ||
      activeThreadTab.kind === "nanobot-log"
    ) {
      if (activeThreadId !== null && activeWorkspaceId) {
        setActiveThreadId(null, activeWorkspaceId);
      }
      if (!activeThreadTab.loaded) {
        markTabLoaded(activeThreadTab.id);
      }
      return;
    }
    if (activeWorkspaceId !== activeThreadTab.workspaceId) {
      setActiveWorkspaceId(activeThreadTab.workspaceId);
    }
    if (
      activeThreadId !== activeThreadTab.threadId ||
      activeWorkspaceId !== activeThreadTab.workspaceId
    ) {
      setActiveThreadId(activeThreadTab.threadId, activeThreadTab.workspaceId);
    }
    if (!activeThreadTab.loaded) {
      markTabLoaded(activeThreadTab.id);
    }
  }, [
    activeThreadId,
    activeThreadTab,
    activeWorkspaceId,
    homeView,
    markTabLoaded,
    setActiveThreadId,
    setActiveWorkspaceId,
  ]);

  useEffect(() => {
    if (!activeWorkspaceId || !activeThreadId) {
      return;
    }
    const tabId = makeThreadTabId(activeWorkspaceId, activeThreadId);
    if (closedThreadTabIdsRef.current.has(tabId)) {
      return;
    }
    if (threadTabs.some((tab) => tab.id === tabId)) {
      return;
    }
    const fallbackName = `Agent ${activeThreadId.slice(0, 4)}`;
    const threadName =
      threadsByWorkspace[activeWorkspaceId]?.find(
        (thread) => thread.id === activeThreadId,
      )?.name ?? fallbackName;
    openThreadTab(activeWorkspaceId, activeThreadId, threadName);
  }, [
    activeThreadId,
    activeWorkspaceId,
    makeThreadTabId,
    openThreadTab,
    threadTabs,
    threadsByWorkspace,
  ]);

  const openThreadTabForWorkspace = useCallback(
    (workspaceId: string, threadId: string) => {
      setHomeView(false);
      closedThreadTabIdsRef.current.delete(makeThreadTabId(workspaceId, threadId));
      const fallbackName = `Agent ${threadId.slice(0, 4)}`;
      const threadName =
        threadsByWorkspace[workspaceId]?.find((thread) => thread.id === threadId)
          ?.name ?? fallbackName;
      openThreadTab(workspaceId, threadId, threadName);
    },
    [makeThreadTabId, openThreadTab, setHomeView, threadsByWorkspace],
  );

  const openWorkspaceTabForWorkspace = useCallback(
    (workspaceId: string) => {
      setHomeView(false);
      const title = workspacesById.get(workspaceId)?.name ?? "Workspace";
      openWorkspaceTab(workspaceId, title);
    },
    [openWorkspaceTab, setHomeView, workspacesById],
  );

  const handleCloseThreadTab = useCallback(
    (tabId: string) => {
      const closingIndex = threadTabs.findIndex((tab) => tab.id === tabId);
      if (closingIndex === -1) {
        return;
      }
      const closingTab = threadTabs[closingIndex];
      if (closingTab.kind === "thread") {
        closedThreadTabIdsRef.current.add(tabId);
      }
      closeThreadTab(tabId);
      if (activeThreadTabId !== tabId) {
        return;
      }
      const remainingTabs = threadTabs.filter((tab) => tab.id !== tabId);
      if (remainingTabs.length === 0) {
        if (
          closingTab.kind === "thread" ||
          closingTab.kind === "workspace"
        ) {
          setActiveThreadId(null, closingTab.workspaceId);
        } else if (activeWorkspaceId) {
          setActiveThreadId(null, activeWorkspaceId);
        }
        setHomeView(true);
        selectHomeRef.current();
        return;
      }
      const nextTab =
        remainingTabs[closingIndex - 1] ?? remainingTabs[closingIndex] ?? null;
      if (!nextTab) {
        return;
      }
      if (nextTab.kind === "home") {
        setHomeView(true);
        selectHomeRef.current();
        return;
      }
      setHomeView(false);
      if (nextTab.kind === "thread") {
        setActiveThreadId(nextTab.threadId, nextTab.workspaceId);
        return;
      }
      if (nextTab.kind === "workspace") {
        setActiveThreadId(null, nextTab.workspaceId);
        return;
      }
      if (activeWorkspaceId) {
        setActiveThreadId(null, activeWorkspaceId);
      }
    },
    [
      activeWorkspaceId,
      activeThreadTabId,
      closeThreadTab,
      setActiveThreadId,
      setHomeView,
      threadTabs,
    ],
  );

  useAutoExitEmptyDiff({
    centerMode,
    autoExitEnabled: diffSource === "local",
    activeDiffCount: activeDiffs.length,
    activeDiffLoading,
    activeDiffError,
    activeThreadId,
    isCompact,
    setCenterMode,
    setSelectedDiffPath,
    setActiveTab,
  });

  const { handleCopyThread } = useCopyThread({
    activeItems,
    onDebug: addDebugEntry,
  });

  const {
    renamePrompt,
    openRenamePrompt,
    handleRenamePromptChange,
    handleRenamePromptCancel,
    handleRenamePromptConfirm,
  } = useRenameThreadPrompt({
    threadsByWorkspace,
    renameThread,
  });

  const {
    renamePrompt: renameWorktreePrompt,
    notice: renameWorktreeNotice,
    upstreamPrompt: renameWorktreeUpstreamPrompt,
    confirmUpstream: confirmRenameWorktreeUpstream,
    openRenamePrompt: openRenameWorktreePrompt,
    handleRenameChange: handleRenameWorktreeChange,
    handleRenameCancel: handleRenameWorktreeCancel,
    handleRenameConfirm: handleRenameWorktreeConfirm,
  } = useRenameWorktreePrompt({
    workspaces,
    activeWorkspaceId,
    renameWorktree,
    renameWorktreeUpstream,
    onRenameSuccess: (workspace) => {
      resetWorkspaceThreads(workspace.id);
      void listThreadsForWorkspace(workspace);
      if (activeThreadId && activeWorkspaceId === workspace.id) {
        void refreshThread(workspace.id, activeThreadId);
      }
    },
  });

  const handleRenameThread = useCallback(
    (workspaceId: string, threadId: string) => {
      openRenamePrompt(workspaceId, threadId);
    },
    [openRenamePrompt],
  );

  const handleOpenRenameWorktree = useCallback(() => {
    if (activeWorkspace) {
      openRenameWorktreePrompt(activeWorkspace.id);
    }
  }, [activeWorkspace, openRenameWorktreePrompt]);

  const {
    terminalTabs,
    activeTerminalId,
    onSelectTerminal,
    onNewTerminal,
    onCloseTerminal,
    terminalState,
    ensureTerminalWithTitle,
    restartTerminalSession,
  } = useTerminalController({
    activeWorkspaceId,
    activeWorkspace,
    terminalOpen,
    onCloseTerminalPanel: closeTerminalPanel,
    onDebug: addDebugEntry,
  });

  const ensureLaunchTerminal = useCallback(
    (workspaceId: string) => ensureTerminalWithTitle(workspaceId, "launch", "Launch"),
    [ensureTerminalWithTitle],
  );

  const launchScriptState = useWorkspaceLaunchScript({
    activeWorkspace,
    updateWorkspaceSettings,
    openTerminal,
    ensureLaunchTerminal,
    restartLaunchSession: restartTerminalSession,
    terminalState,
    activeTerminalId,
  });

  const worktreeSetupScriptState = useWorktreeSetupScript({
    ensureTerminalWithTitle,
    restartTerminalSession,
    openTerminal,
    onDebug: addDebugEntry,
  });

  const handleWorktreeCreated = useCallback(
    async (worktree: WorkspaceInfo, _parentWorkspace?: WorkspaceInfo) => {
      await worktreeSetupScriptState.maybeRunWorktreeSetupScript(worktree);
    },
    [worktreeSetupScriptState],
  );

  const {
    exitDiffView,
    selectWorkspace,
    selectHome: selectHomeAction,
  } = useWorkspaceSelection({
    workspaces,
    isCompact,
    activeWorkspaceId,
    setActiveTab,
    setActiveWorkspaceId,
    updateWorkspaceSettings,
    setCenterMode,
    setSelectedDiffPath,
  });
  selectHomeRef.current = selectHomeAction;
  const {
    worktreePrompt,
    openPrompt: openWorktreePrompt,
    confirmPrompt: confirmWorktreePrompt,
    cancelPrompt: cancelWorktreePrompt,
    updateBranch: updateWorktreeBranch,
    updateSetupScript: updateWorktreeSetupScript,
  } = useWorktreePrompt({
    addWorktreeAgent,
    updateWorkspaceSettings,
    connectWorkspace,
    onSelectWorkspace: selectWorkspace,
    onWorktreeCreated: handleWorktreeCreated,
    onCompactActivate: isCompact ? () => setActiveTab("codex") : undefined,
    onError: (message) => {
      addDebugEntry({
        id: `${Date.now()}-client-add-worktree-error`,
        timestamp: Date.now(),
        source: "error",
        label: "worktree/add error",
        payload: message,
      });
    },
  });

  const resolveCloneProjectContext = useCallback(
    (workspace: WorkspaceInfo) => {
      const groupId = workspace.settings.groupId ?? null;
      const group = groupId
        ? appSettings.workspaceGroups.find((entry) => entry.id === groupId)
        : null;
      return {
        groupId,
        copiesFolder: group?.copiesFolder ?? null,
      };
    },
    [appSettings.workspaceGroups],
  );

  const handleSelectOpenAppId = useCallback(
    (id: string) => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(OPEN_APP_STORAGE_KEY, id);
      }
      setAppSettings((current) => {
        if (current.selectedOpenAppId === id) {
          return current;
        }
        const nextSettings = {
          ...current,
          selectedOpenAppId: id,
        };
        void queueSaveSettings(nextSettings);
        return nextSettings;
      });
    },
    [queueSaveSettings, setAppSettings],
  );

  const handleToggleTheme = useCallback(() => {
    setAppSettings((current) => {
      const isDark =
        typeof document !== "undefined"
          ? document.documentElement.classList.contains("dark")
          : current.theme === "dark";
      const nextTheme: ThemePreference = isDark ? "light" : "dark";
      if (current.theme === nextTheme) {
        return current;
      }
      const nextSettings = {
        ...current,
        theme: nextTheme,
      };
      void queueSaveSettings(nextSettings);
      return nextSettings;
    });
  }, [queueSaveSettings, setAppSettings]);

  const handleSelectThemeColor = useCallback(
    (color: ThemeColor) => {
      setAppSettings((current) => {
        if (current.themeColor === color) {
          return current;
        }
        const nextSettings = {
          ...current,
          themeColor: color,
        };
        void queueSaveSettings(nextSettings);
        return nextSettings;
      });
    },
    [queueSaveSettings, setAppSettings],
  );

  const openAppIconById = useOpenAppIcons(appSettings.openAppTargets);

  const persistProjectCopiesFolder = useCallback(
    async (groupId: string, copiesFolder: string) => {
      await queueSaveSettings({
        ...appSettings,
        workspaceGroups: appSettings.workspaceGroups.map((entry) =>
          entry.id === groupId ? { ...entry, copiesFolder } : entry,
        ),
      });
    },
    [appSettings, queueSaveSettings],
  );

  const {
    clonePrompt,
    openPrompt: openClonePrompt,
    confirmPrompt: confirmClonePrompt,
    cancelPrompt: cancelClonePrompt,
    updateCopyName: updateCloneCopyName,
    chooseCopiesFolder: chooseCloneCopiesFolder,
    useSuggestedCopiesFolder: useSuggestedCloneCopiesFolder,
    clearCopiesFolder: clearCloneCopiesFolder,
  } = useClonePrompt({
    addCloneAgent,
    connectWorkspace,
    onSelectWorkspace: selectWorkspace,
    resolveProjectContext: resolveCloneProjectContext,
    persistProjectCopiesFolder,
    onCompactActivate: isCompact ? () => setActiveTab("codex") : undefined,
    onError: (message) => {
      addDebugEntry({
        id: `${Date.now()}-client-add-clone-error`,
        timestamp: Date.now(),
        source: "error",
        label: "clone/add error",
        payload: message,
      });
    },
  });

  const latestAgentRuns = useMemo(() => {
    const entries: Array<{
      threadId: string;
      message: string;
      timestamp: number;
      projectName: string;
      groupName?: string | null;
      workspaceId: string;
      isProcessing: boolean;
    }> = [];
    workspaces.forEach((workspace) => {
      const threads = threadsByWorkspace[workspace.id] ?? [];
      threads.forEach((thread) => {
        const entry = lastAgentMessageByThread[thread.id];
        if (!entry) {
          return;
        }
        entries.push({
          threadId: thread.id,
          message: entry.text,
          timestamp: entry.timestamp,
          projectName: workspace.name,
          groupName: getWorkspaceGroupName(workspace.id),
          workspaceId: workspace.id,
          isProcessing: threadStatusById[thread.id]?.isProcessing ?? false
        });
      });
    });
    return entries.sort((a, b) => b.timestamp - a.timestamp).slice(0, 3);
  }, [
    lastAgentMessageByThread,
    getWorkspaceGroupName,
    threadStatusById,
    threadsByWorkspace,
    workspaces
  ]);
  const isLoadingLatestAgents = useMemo(
    () =>
      !hasLoaded ||
      workspaces.some(
        (workspace) => threadListLoadingByWorkspace[workspace.id] ?? false
      ),
    [hasLoaded, threadListLoadingByWorkspace, workspaces]
  );

  const { getRateLimits } = useStickyRateLimits(
    rateLimitsByWorkspace,
    workspaces.map((workspace) => workspace.id),
  );
  const activeRateLimits = getRateLimits(activeWorkspaceId);
  const activeTokenUsage = activeThreadId
    ? tokenUsageByThread[activeThreadId] ?? null
    : null;
  const activePlan = activeThreadId
    ? planByThread[activeThreadId] ?? null
    : null;
  const hasActivePlan = Boolean(
    activePlan && (activePlan.steps.length > 0 || activePlan.explanation)
  );
  const showHome = homeView || activeThreadTab?.kind === "home";
  const showWorkspaceHome = Boolean(
    !showHome &&
      activeWorkspace &&
      (activeThreadTab?.kind === "workspace" ||
        (!activeThreadTab && !activeThreadId)),
  );
  const [usageMetric, setUsageMetric] = useState<"tokens" | "time">("tokens");
  const [usageWorkspaceId, setUsageWorkspaceId] = useState<string | null>(null);
  const usageWorkspaceOptions = useMemo(
    () =>
      workspaces.map((workspace) => {
        const groupName = getWorkspaceGroupName(workspace.id);
        const label = groupName
          ? `${groupName} / ${workspace.name}`
          : workspace.name;
        return { id: workspace.id, label };
      }),
    [getWorkspaceGroupName, workspaces],
  );
  const usageWorkspacePath = useMemo(() => {
    if (!usageWorkspaceId) {
      return null;
    }
    return workspacesById.get(usageWorkspaceId)?.path ?? null;
  }, [usageWorkspaceId, workspacesById]);
  useEffect(() => {
    if (!usageWorkspaceId) {
      return;
    }
    if (workspaces.some((workspace) => workspace.id === usageWorkspaceId)) {
      return;
    }
    setUsageWorkspaceId(null);
  }, [usageWorkspaceId, workspaces]);
  const {
    snapshot: localUsageSnapshot,
    isLoading: isLoadingLocalUsage,
    error: localUsageError,
    refresh: refreshLocalUsage,
  } = useLocalUsage(showHome, usageWorkspacePath);
  const canInterrupt = activeThreadId
    ? threadStatusById[activeThreadId]?.isProcessing ?? false
    : false;
  const isProcessing = activeThreadId
    ? threadStatusById[activeThreadId]?.isProcessing ?? false
    : false;
  const isReviewing = activeThreadId
    ? threadStatusById[activeThreadId]?.isReviewing ?? false
    : false;
  const {
    activeImages,
    attachImages,
    pickImages,
    removeImage,
    clearActiveImages,
    setImagesForThread,
    removeImagesForThread,
    getImagesForThread,
    activeQueue,
    handleSend,
    queueMessage,
    prefillDraft,
    setPrefillDraft,
    composerInsert,
    setComposerInsert,
    activeDraft,
    handleDraftChange,
    handleSendPrompt,
    handleEditQueued,
    handleDeleteQueued,
    clearDraftForThread,
    getDraftForThread,
  } = useComposerController({
    activeThreadId,
    activeWorkspaceId,
    activeWorkspace,
    isProcessing,
    isReviewing,
    steerEnabled: appSettings.experimentalSteerEnabled,
    connectWorkspace,
    sendUserMessage,
    startReview,
  });

  const otherDraftSource = useMemo(() => {
    if (!activeThreadId) {
      return null;
    }
    let best:
      | {
          tab: ThreadTab & { kind: "thread"; threadId: string };
          text: string;
          images: string[];
        }
      | null = null;
    for (const tab of threadTabs) {
      if (tab.kind !== "thread") {
        continue;
      }
      if (tab.threadId === activeThreadId) {
        continue;
      }
      const text = getDraftForThread(tab.threadId);
      const images = getImagesForThread(tab.threadId);
      if (!text.trim() && images.length === 0) {
        continue;
      }
      if (!best || tab.lastActiveAt > best.tab.lastActiveAt) {
        best = { tab, text, images };
      }
    }
    if (!best) {
      return null;
    }
    return {
      workspaceId: best.tab.workspaceId,
      threadId: best.tab.threadId,
      title: best.tab.title,
      text: best.text,
      images: best.images,
    };
  }, [activeThreadId, getDraftForThread, getImagesForThread, threadTabs]);

  const handleCopyOtherDraft = useCallback(() => {
    if (!otherDraftSource || !activeThreadId) {
      return;
    }
    handleDraftChange(otherDraftSource.text, { immediate: true });
    setImagesForThread(activeThreadId, otherDraftSource.images);
    composerInputRef.current?.focus();
  }, [activeThreadId, handleDraftChange, otherDraftSource, setImagesForThread]);
  const otherDraftLabel = useMemo(() => {
    if (!otherDraftSource) {
      return null;
    }
    const workspaceName = workspacesById.get(otherDraftSource.workspaceId)?.name;
    if (!workspaceName) {
      return otherDraftSource.title;
    }
    return `${workspaceName} / ${otherDraftSource.title}`;
  }, [otherDraftSource, workspacesById]);

  const handleInsertComposerText = useComposerInsert({
    activeThreadId,
    draftText: activeDraft,
    onDraftChange: handleDraftChange,
    textareaRef: composerInputRef,
  });

  const {
    runs: workspaceRuns,
    draft: workspacePrompt,
    runMode: workspaceRunMode,
    modelSelections: workspaceModelSelections,
    error: workspaceRunError,
    isSubmitting: workspaceRunSubmitting,
    setDraft: setWorkspacePrompt,
    setRunMode: setWorkspaceRunMode,
    toggleModelSelection: toggleWorkspaceModelSelection,
    setModelCount: setWorkspaceModelCount,
    startRun: startWorkspaceRun,
  } = useWorkspaceHome({
    activeWorkspace,
    models,
    selectedModelId,
    addWorktreeAgent,
    connectWorkspace,
    startThreadForWorkspace,
    sendUserMessageToThread,
    onWorktreeCreated: handleWorktreeCreated,
  });
  const RECENT_THREAD_LIMIT = 8;
  const { recentThreadInstances, recentThreadsUpdatedAt } = useMemo(() => {
    if (!activeWorkspaceId) {
      return { recentThreadInstances: [], recentThreadsUpdatedAt: null };
    }
    const threads = threadsByWorkspace[activeWorkspaceId] ?? [];
    if (threads.length === 0) {
      return { recentThreadInstances: [], recentThreadsUpdatedAt: null };
    }
    const sorted = [...threads].sort((a, b) => b.updatedAt - a.updatedAt);
    const slice = sorted.slice(0, RECENT_THREAD_LIMIT);
    const updatedAt = slice.reduce(
      (max, thread) => (thread.updatedAt > max ? thread.updatedAt : max),
      0,
    );
    const instances = slice.map((thread, index) => ({
      id: `recent-${thread.id}`,
      workspaceId: activeWorkspaceId,
      threadId: thread.id,
      modelId: null,
      modelLabel: thread.name?.trim() || "Untitled thread",
      sequence: index + 1,
    }));
    return {
      recentThreadInstances: instances,
      recentThreadsUpdatedAt: updatedAt > 0 ? updatedAt : null,
    };
  }, [activeWorkspaceId, threadsByWorkspace]);
  const {
    content: agentMdContent,
    exists: agentMdExists,
    truncated: agentMdTruncated,
    isLoading: agentMdLoading,
    isSaving: agentMdSaving,
    error: agentMdError,
    isDirty: agentMdDirty,
    setContent: setAgentMdContent,
    refresh: refreshAgentMd,
    save: saveAgentMd,
  } = useWorkspaceAgentMd({
    activeWorkspace,
    onDebug: addDebugEntry,
  });

  const {
    commitMessage,
    commitMessageLoading,
    commitMessageError,
    commitLoading,
    pushLoading,
    syncLoading,
    commitError,
    pushError,
    syncError,
    onCommitMessageChange: handleCommitMessageChange,
    onGenerateCommitMessage: handleGenerateCommitMessage,
    onCommit: handleCommit,
    onCommitAndPush: handleCommitAndPush,
    onCommitAndSync: handleCommitAndSync,
    onPush: handlePush,
    onSync: handleSync,
  } = useGitCommitController({
    activeWorkspace,
    activeWorkspaceId,
    activeWorkspaceIdRef,
    gitStatus,
    refreshGitStatus,
    refreshGitLog,
  });

  const handleSendPromptToNewAgent = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!activeWorkspace || !trimmed) {
        return;
      }
      if (!activeWorkspace.connected) {
        await connectWorkspace(activeWorkspace);
      }
      const threadId = await startThreadForWorkspace(activeWorkspace.id, {
        activate: false,
      });
      if (!threadId) {
        return;
      }
      await sendUserMessageToThread(activeWorkspace, threadId, trimmed, []);
    },
    [activeWorkspace, connectWorkspace, sendUserMessageToThread, startThreadForWorkspace],
  );


  const handleCreatePrompt = useCallback(
    async (data: {
      scope: "workspace" | "global";
      name: string;
      description?: string | null;
      argumentHint?: string | null;
      content: string;
    }) => {
      try {
        await createPrompt(data);
      } catch (error) {
        alertError(error);
      }
    },
    [alertError, createPrompt],
  );

  const handleUpdatePrompt = useCallback(
    async (data: {
      path: string;
      name: string;
      description?: string | null;
      argumentHint?: string | null;
      content: string;
    }) => {
      try {
        await updatePrompt(data);
      } catch (error) {
        alertError(error);
      }
    },
    [alertError, updatePrompt],
  );

  const handleDeletePrompt = useCallback(
    async (path: string) => {
      try {
        await deletePrompt(path);
      } catch (error) {
        alertError(error);
      }
    },
    [alertError, deletePrompt],
  );

  const handleMovePrompt = useCallback(
    async (data: { path: string; scope: "workspace" | "global" }) => {
      try {
        await movePrompt(data);
      } catch (error) {
        alertError(error);
      }
    },
    [alertError, movePrompt],
  );

  const handleRevealWorkspacePrompts = useCallback(async () => {
    try {
      const path = await getWorkspacePromptsDir();
      await revealItemInDir(path);
    } catch (error) {
      alertError(error);
    }
  }, [alertError, getWorkspacePromptsDir]);

  const handleRevealGeneralPrompts = useCallback(async () => {
    try {
      const path = await getGlobalPromptsDir();
      if (!path) {
        return;
      }
      await revealItemInDir(path);
    } catch (error) {
      alertError(error);
    }
  }, [alertError, getGlobalPromptsDir]);

  const isWorktreeWorkspace = activeWorkspace?.kind === "worktree";
  const activeParentWorkspace = isWorktreeWorkspace
    ? workspacesById.get(activeWorkspace?.parentId ?? "") ?? null
    : null;
  const worktreeLabel = isWorktreeWorkspace
    ? activeWorkspace?.worktree?.branch ?? activeWorkspace?.name ?? null
    : null;
  const activeRenamePrompt =
    renameWorktreePrompt?.workspaceId === activeWorkspace?.id
      ? renameWorktreePrompt
      : null;
  const worktreeRename =
    isWorktreeWorkspace && activeWorkspace
      ? {
          name: activeRenamePrompt?.name ?? worktreeLabel ?? "",
          error: activeRenamePrompt?.error ?? null,
          notice: renameWorktreeNotice,
          isSubmitting: activeRenamePrompt?.isSubmitting ?? false,
          isDirty: activeRenamePrompt
            ? activeRenamePrompt.name.trim() !==
              activeRenamePrompt.originalName.trim()
            : false,
          upstream:
            renameWorktreeUpstreamPrompt?.workspaceId === activeWorkspace.id
              ? {
                  oldBranch: renameWorktreeUpstreamPrompt.oldBranch,
                  newBranch: renameWorktreeUpstreamPrompt.newBranch,
                  error: renameWorktreeUpstreamPrompt.error,
                  isSubmitting: renameWorktreeUpstreamPrompt.isSubmitting,
                  onConfirm: confirmRenameWorktreeUpstream,
                }
              : null,
          onFocus: handleOpenRenameWorktree,
          onChange: handleRenameWorktreeChange,
          onCancel: handleRenameWorktreeCancel,
          onCommit: handleRenameWorktreeConfirm,
        }
      : null;
  const baseWorkspaceRef = useRef(activeParentWorkspace ?? activeWorkspace);

  useEffect(() => {
    baseWorkspaceRef.current = activeParentWorkspace ?? activeWorkspace;
  }, [activeParentWorkspace, activeWorkspace]);

  useEffect(() => {
    if (!isPhone) {
      return;
    }
    if (!activeWorkspace && activeTab !== "projects") {
      setActiveTab("projects");
    }
  }, [activeTab, activeWorkspace, isPhone]);

  useEffect(() => {
    if (!isTablet) {
      return;
    }
    if (activeTab === "projects") {
      setActiveTab("codex");
    }
  }, [activeTab, isTablet]);

  useWindowDrag("titlebar");
  useWorkspaceRestore({
    workspaces,
    hasLoaded,
    listThreadsForWorkspace,
  });
  useWorkspaceRefreshOnFocus({
    workspaces,
    refreshWorkspaces,
    listThreadsForWorkspace,
    enabled: appSettings.refreshThreadsOnFocus,
  });

  const {
    handleAddWorkspace,
    handleAddWorkspaceFromPath,
    handleAddAgent,
    handleAddWorktreeAgent,
    handleAddCloneAgent,
  } = useWorkspaceActions({
    activeWorkspace,
    isCompact,
    addWorkspace,
    addWorkspaceFromPath,
    connectWorkspace,
    startThreadForWorkspace,
    setActiveThreadId,
    setActiveTab,
    exitDiffView,
    selectWorkspace,
    openWorktreePrompt,
    openClonePrompt,
    composerInputRef,
    onDebug: addDebugEntry,
  });

  const handleDropWorkspacePaths = useCallback(
    async (paths: string[]) => {
      const uniquePaths = Array.from(
        new Set(paths.filter((path) => path.length > 0)),
      );
      if (uniquePaths.length === 0) {
        return;
      }
      uniquePaths.forEach((path) => {
        void handleAddWorkspaceFromPath(path);
      });
    },
    [handleAddWorkspaceFromPath],
  );

  const {
    dropTargetRef: workspaceDropTargetRef,
    isDragOver: isWorkspaceDropActive,
    handleDragOver: handleWorkspaceDragOver,
    handleDragEnter: handleWorkspaceDragEnter,
    handleDragLeave: handleWorkspaceDragLeave,
    handleDrop: handleWorkspaceDrop,
  } = useWorkspaceDropZone({
    onDropPaths: handleDropWorkspacePaths,
  });

  const handleArchiveActiveThread = useCallback(() => {
    if (!activeWorkspaceId || !activeThreadId) {
      return;
    }
    removeThread(activeWorkspaceId, activeThreadId);
    clearDraftForThread(activeThreadId);
    removeImagesForThread(activeThreadId);
  }, [
    activeThreadId,
    activeWorkspaceId,
    clearDraftForThread,
    removeImagesForThread,
    removeThread,
  ]);

  useInterruptShortcut({
    isEnabled: canInterrupt,
    shortcut: appSettings.interruptShortcut,
    onTrigger: () => {
      void interruptTurn();
    },
  });

  const [composerOverrides, setComposerOverrides] = useState<{
    sendLabel?: string;
    onSend: (text: string, images: string[]) => void | Promise<void>;
    onQueue: (text: string, images: string[]) => void | Promise<void>;
  } | null>(null);
  const [topbarOverrides, setTopbarOverrides] =
    useState<ThreadTopbarOverrides | null>(null);
  const handleComposerOverridesChange = useCallback(
    (next: typeof composerOverrides) => {
      setComposerOverrides((prev) => {
        if (prev === next) {
          return prev;
        }
        if (!prev || !next) {
          return next;
        }
        if (
          prev.sendLabel === next.sendLabel &&
          prev.onSend === next.onSend &&
          prev.onQueue === next.onQueue
        ) {
          return prev;
        }
        return next;
      });
    },
    [],
  );
  const handleTopbarOverridesChange = useCallback(
    (next: ThreadTopbarOverrides | null) => {
      setTopbarOverrides((prev) => {
        if (prev === next) {
          return prev;
        }
        if (!prev || !next) {
          return next;
        }
        if (
          prev.centerMode === next.centerMode &&
          prev.gitDiffViewStyle === next.gitDiffViewStyle &&
          prev.onSelectDiffViewStyle === next.onSelectDiffViewStyle &&
          prev.onExitDiff === next.onExitDiff
        ) {
          return prev;
        }
        return next;
      });
    },
    [],
  );

  const {
    handleSelectPullRequest,
    resetPullRequestSelection,
    composerSendLabel: pullRequestSendLabel,
    handleComposerSend: pullRequestSend,
    handleComposerQueue: pullRequestQueue,
  } = usePullRequestComposer({
    activeWorkspace,
    selectedPullRequest,
    gitPullRequestDiffs,
    filePanelMode,
    gitPanelMode,
    centerMode,
    isCompact,
    setSelectedPullRequest,
    setDiffSource,
    setSelectedDiffPath,
    setCenterMode,
    setGitPanelMode,
    setPrefillDraft,
    setActiveTab,
    connectWorkspace,
    startThreadForWorkspace,
    sendUserMessageToThread,
    clearActiveImages,
    handleSend,
    queueMessage,
  });

  const effectiveComposerSendLabel = isCompact
    ? pullRequestSendLabel
    : composerOverrides?.sendLabel;
  const effectiveComposerSend = isCompact
    ? pullRequestSend
    : composerOverrides?.onSend ?? handleSend;
  const effectiveComposerQueue = isCompact
    ? pullRequestQueue
    : composerOverrides?.onQueue ?? queueMessage;
  const composerSendLabel = effectiveComposerSendLabel;
  const handleComposerSend = effectiveComposerSend;
  const handleComposerQueue = effectiveComposerQueue;

  const handleSelectWorkspaceInstance = useCallback(
    (workspaceId: string, threadId: string) => {
      exitDiffView();
      resetPullRequestSelection();
      selectWorkspace(workspaceId);
      openThreadTabForWorkspace(workspaceId, threadId);
      if (isCompact) {
        setActiveTab("codex");
      }
    },
    [
      exitDiffView,
      isCompact,
      resetPullRequestSelection,
      selectWorkspace,
      setActiveTab,
      openThreadTabForWorkspace,
    ],
  );

  const handleExitDiff = useCallback(() => {
    setCenterMode("chat");
    setSelectedDiffPath(null);
  }, [setCenterMode, setSelectedDiffPath]);

  const effectiveCenterMode = topbarOverrides?.centerMode ?? centerMode;
  const effectiveGitDiffViewStyle =
    topbarOverrides?.gitDiffViewStyle ?? gitDiffViewStyle;
  const effectiveSelectDiffViewStyle =
    topbarOverrides?.onSelectDiffViewStyle ?? setGitDiffViewStyle;
  const effectiveExitDiff = topbarOverrides?.onExitDiff ?? handleExitDiff;

  const orderValue = (entry: WorkspaceInfo) =>
    typeof entry.settings.sortOrder === "number"
      ? entry.settings.sortOrder
      : Number.MAX_SAFE_INTEGER;

  const handleMoveWorkspace = async (
    workspaceId: string,
    direction: "up" | "down"
  ) => {
    const target = workspacesById.get(workspaceId);
    if (!target || (target.kind ?? "main") === "worktree") {
      return;
    }
    const targetGroupId = target.settings.groupId ?? null;
    const ordered = workspaces
      .filter(
        (entry) =>
          (entry.kind ?? "main") !== "worktree" &&
          (entry.settings.groupId ?? null) === targetGroupId,
      )
      .slice()
      .sort((a, b) => {
        const orderDiff = orderValue(a) - orderValue(b);
        if (orderDiff !== 0) {
          return orderDiff;
        }
        return a.name.localeCompare(b.name);
      });
    const index = ordered.findIndex((entry) => entry.id === workspaceId);
    if (index === -1) {
      return;
    }
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= ordered.length) {
      return;
    }
    const next = ordered.slice();
    const temp = next[index];
    next[index] = next[nextIndex];
    next[nextIndex] = temp;
    await Promise.all(
      next.map((entry, idx) =>
        updateWorkspaceSettings(entry.id, {
          sortOrder: idx
        })
      )
    );
  };

  const logTabActive =
    activeThreadTab?.kind === "debug-log" ||
    activeThreadTab?.kind === "nanobot-log";
  const showComposer = (!isCompact
    ? centerMode === "chat" || centerMode === "diff"
    : (isTablet ? tabletTab : activeTab) === "codex") &&
    !showWorkspaceHome &&
    !logTabActive;
  const showGitDetail = Boolean(selectedDiffPath) && isPhone;
  const isThreadOpen = Boolean(activeThreadId && showComposer);

  useArchiveShortcut({
    isEnabled: isThreadOpen,
    shortcut: appSettings.archiveThreadShortcut,
    onTrigger: handleArchiveActiveThread,
  });

  const { handleCycleAgent, handleCycleWorkspace } = useWorkspaceCycling({
    workspaces,
    groupedWorkspaces,
    threadsByWorkspace,
    getThreadRows,
    getPinTimestamp,
    activeWorkspaceIdRef,
    activeThreadIdRef,
    exitDiffView,
    resetPullRequestSelection,
    selectWorkspace,
    setActiveThreadId,
  });

  useAppMenuEvents({
    activeWorkspaceRef,
    baseWorkspaceRef,
    onAddWorkspace: () => {
      void handleAddWorkspace();
    },
    onAddAgent: (workspace) => {
      void handleAddAgent(workspace);
    },
    onAddWorktreeAgent: (workspace) => {
      void handleAddWorktreeAgent(workspace);
    },
    onAddCloneAgent: (workspace) => {
      void handleAddCloneAgent(workspace);
    },
    onOpenSettings: () => openSettings(),
    onCycleAgent: handleCycleAgent,
    onCycleWorkspace: handleCycleWorkspace,
    onToggleDebug: handleOpenDebugLog,
    onToggleTerminal: handleToggleTerminal,
    sidebarCollapsed,
    rightPanelCollapsed,
    onExpandSidebar: expandSidebar,
    onCollapseSidebar: collapseSidebar,
    onExpandRightPanel: expandRightPanel,
    onCollapseRightPanel: collapseRightPanel,
  });

  useMenuAcceleratorController({ appSettings, onDebug: addDebugEntry });
  const dropOverlayActive = isWorkspaceDropActive;
  const dropOverlayText = "Drop Project Here";
  const appClassName = `app ${isCompact ? "layout-compact" : "layout-desktop"}${
    isPhone ? " layout-phone" : ""
  }${isTablet ? " layout-tablet" : ""}${
    reduceTransparency ? " reduced-transparency" : ""
  }${!isCompact && sidebarCollapsed ? " sidebar-collapsed" : ""}${
    !isCompact && rightPanelCollapsed ? " right-panel-collapsed" : ""
  }`;
  const sidebarColumnWidth = sidebarCollapsed ? 48 : sidebarWidth;
  const {
    sidebarNode,
    messagesNode,
    composerNode,
    approvalToastsNode,
    updateToastNode,
    errorToastsNode,
    homeNode,
    mainHeaderNode,
    desktopTopbarLeftNode,
    tabletNavNode,
    tabBarNode,
    gitDiffPanelNode,
    gitDiffViewerNode,
    planPanelNode,
    debugPanelNode,
    debugPanelFullNode,
    terminalDockNode,
    compactEmptyCodexNode,
    compactEmptyGitNode,
    compactGitBackNode,
  } = useLayoutNodes({
    workspaces,
    groupedWorkspaces,
    hasWorkspaceGroups: workspaceGroups.length > 0,
    deletingWorktreeIds,
    threadsByWorkspace,
    threadParentById,
    threadStatusById,
    openThreadIds,
    threadListLoadingByWorkspace,
    threadListPagingByWorkspace,
    threadListCursorByWorkspace,
    activeWorkspaceId,
    activeThreadId,
    activeItems,
    happyEnabled,
    happyConnected,
    happyMessageStatusById,
    happyMessageIdByItemId,
    activeRateLimits,
    experimentalYunyiEnabled: appSettings.experimentalYunyiEnabled,
    experimentalYunyiToken: appSettings.experimentalYunyiToken,
    codeBlockCopyUseModifier: appSettings.composerCodeBlockCopyUseModifier,
    openAppTargets: appSettings.openAppTargets,
    openAppIconById,
    selectedOpenAppId: appSettings.selectedOpenAppId,
    onSelectOpenAppId: handleSelectOpenAppId,
    approvals,
    userInputRequests,
    handleApprovalDecision,
    handleApprovalRemember,
    handleUserInputSubmit,
    onRetryHappyMessage: retryHappyMessage,
    onOpenSettings: () => openSettings(),
    onOpenDictationSettings: () => openSettings("dictation"),
    onOpenDebug: handleOpenDebugLog,
    onOpenNanobotLog: handleOpenNanobotLog,
    showDebugButton,
    nanobotStatus: nanobotStatusSnapshot,
    themePreference: appSettings.theme,
    themeColor: appSettings.themeColor,
    onToggleTheme: handleToggleTheme,
    onSelectThemeColor: handleSelectThemeColor,
    onAddWorkspace: handleAddWorkspace,
    onSelectHome: () => {
      resetPullRequestSelection();
      setHomeView(true);
      selectHomeAction();
      openHomeTab(t("sidebar.home"));
    },
    onSelectWorkspace: (workspaceId) => {
      exitDiffView();
      resetPullRequestSelection();
      selectWorkspace(workspaceId);
      openWorkspaceTabForWorkspace(workspaceId);
      const workspace = workspacesById.get(workspaceId);
      if (workspace && !workspace.connected) {
        void connectWorkspace(workspace);
      }
    },
    onConnectWorkspace: async (workspace) => {
      await connectWorkspace(workspace);
      if (isCompact) {
        setActiveTab("codex");
      }
    },
    onAddAgent: handleAddAgent,
    onAddWorktreeAgent: handleAddWorktreeAgent,
    onAddCloneAgent: handleAddCloneAgent,
    onToggleWorkspaceCollapse: (workspaceId, collapsed) => {
      const target = workspacesById.get(workspaceId);
      if (!target) {
        return;
      }
      void updateWorkspaceSettings(workspaceId, {
        sidebarCollapsed: collapsed,
      });
    },
    onSelectThread: (workspaceId, threadId) => {
      exitDiffView();
      resetPullRequestSelection();
      setHomeView(false);
      const workspace = workspacesById.get(workspaceId);
      void (async () => {
        if (workspace && !workspace.connected) {
          try {
            await connectWorkspace(workspace);
          } catch {
            // Ignore connect errors; thread list will still open.
          }
        }
        selectWorkspace(workspaceId);
        openThreadTabForWorkspace(workspaceId, threadId);
      })();
    },
    onDeleteThread: (workspaceId, threadId) => {
      removeThread(workspaceId, threadId);
      handleCloseThreadTab(`${workspaceId}:${threadId}`);
      clearDraftForThread(threadId);
      removeImagesForThread(threadId);
    },
    onSyncThread: (workspaceId, threadId) => {
      void refreshThread(workspaceId, threadId);
    },
    pinThread,
    unpinThread,
    isThreadPinned,
    getPinTimestamp,
    onRenameThread: (workspaceId, threadId) => {
      handleRenameThread(workspaceId, threadId);
    },
    onDeleteWorkspace: (workspaceId) => {
      void removeWorkspace(workspaceId);
    },
    onDeleteWorktree: (workspaceId) => {
      void removeWorktree(workspaceId);
    },
    onLoadOlderThreads: (workspaceId) => {
      const workspace = workspacesById.get(workspaceId);
      if (!workspace) {
        return;
      }
      void loadOlderThreadsForWorkspace(workspace);
    },
    onReloadWorkspaceThreads: (workspaceId) => {
      const workspace = workspacesById.get(workspaceId);
      if (!workspace) {
        return;
      }
      void (async () => {
        const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
        await reconnectWorkspace(workspace);
        await listThreadsForWorkspace(workspace);
        const durationMs = Math.round(
          (typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt,
        );
        console.info("[workspace/reload_threads]", {
          workspaceId,
          durationMs,
        });
      })().catch((error) => {
        console.error("[workspace/reload_threads] failed", {
          workspaceId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    },
    updaterState,
    onUpdate: startUpdate,
    onDismissUpdate: dismissUpdate,
    errorToasts,
    onDismissErrorToast: dismissErrorToast,
    latestAgentRuns,
    isLoadingLatestAgents,
    localUsageSnapshot,
    isLoadingLocalUsage,
    localUsageError,
    onRefreshLocalUsage: () => {
      refreshLocalUsage()?.catch(() => {});
    },
    usageMetric,
    onUsageMetricChange: setUsageMetric,
    usageWorkspaceId,
    usageWorkspaceOptions,
    onUsageWorkspaceChange: setUsageWorkspaceId,
    onSelectHomeThread: (workspaceId, threadId) => {
      exitDiffView();
      const workspace = workspacesById.get(workspaceId);
      void (async () => {
        if (workspace && !workspace.connected) {
          try {
            await connectWorkspace(workspace);
          } catch {
            // Ignore connect errors; thread list will still open.
          }
        }
        selectWorkspace(workspaceId);
        openThreadTabForWorkspace(workspaceId, threadId);
      })();
      if (isCompact) {
        setActiveTab("codex");
      }
    },
    activeWorkspace,
    activeParentWorkspace,
    worktreeLabel,
    worktreeRename: worktreeRename ?? undefined,
    isWorktreeWorkspace,
    branchName: gitStatus.branchName || "unknown",
    branches,
    onCheckoutBranch: handleCheckoutBranch,
    onCreateBranch: handleCreateBranch,
    onCopyThread: handleCopyThread,
    onToggleTerminal: handleToggleTerminal,
    showTerminalButton: !isCompact,
    launchScript: launchScriptState.launchScript,
    launchScriptEditorOpen: launchScriptState.editorOpen,
    launchScriptDraft: launchScriptState.draftScript,
    launchScriptSaving: launchScriptState.isSaving,
    launchScriptError: launchScriptState.error,
    onRunLaunchScript: launchScriptState.onRunLaunchScript,
    onOpenLaunchScriptEditor: launchScriptState.onOpenEditor,
    onCloseLaunchScriptEditor: launchScriptState.onCloseEditor,
    onLaunchScriptDraftChange: launchScriptState.onDraftScriptChange,
    onSaveLaunchScript: launchScriptState.onSaveLaunchScript,
    mainHeaderActionsNode: (
      <MainHeaderActions
        centerMode={effectiveCenterMode}
        gitDiffViewStyle={effectiveGitDiffViewStyle}
        onSelectDiffViewStyle={effectiveSelectDiffViewStyle}
        isCompact={isCompact}
        sidebarToggleProps={sidebarToggleProps}
      />
    ),
    filePanelMode,
    onFilePanelModeChange: setFilePanelMode,
    fileTreeLoading: isFilesLoading,
    centerMode: effectiveCenterMode,
    onExitDiff: effectiveExitDiff,
    activeTab,
    onSelectTab: setActiveTab,
    tabletNavTab: tabletTab,
    gitPanelMode,
    onGitPanelModeChange: handleGitPanelModeChange,
    gitDiffViewStyle: effectiveGitDiffViewStyle,
    worktreeApplyLabel: "apply",
    worktreeApplyTitle: activeParentWorkspace?.name
      ? `Apply changes to ${activeParentWorkspace.name}`
      : "Apply changes to parent workspace",
    worktreeApplyLoading: isWorktreeWorkspace ? worktreeApplyLoading : false,
    worktreeApplyError: isWorktreeWorkspace ? worktreeApplyError : null,
    worktreeApplySuccess: isWorktreeWorkspace ? worktreeApplySuccess : false,
    onApplyWorktreeChanges: isWorktreeWorkspace
      ? handleApplyWorktreeChanges
      : undefined,
    gitStatus,
    fileStatus,
    selectedDiffPath,
    diffScrollRequestId,
    onSelectDiff: handleSelectDiff,
    gitLogEntries,
    gitLogTotal,
    gitLogAhead,
    gitLogBehind,
    gitLogAheadEntries,
    gitLogBehindEntries,
    gitLogUpstream,
    gitLogError,
    gitLogLoading,
    selectedCommitSha,
    gitIssues,
    gitIssuesTotal,
    gitIssuesLoading,
    gitIssuesError,
    gitPullRequests,
    gitPullRequestsTotal,
    gitPullRequestsLoading,
    gitPullRequestsError,
    selectedPullRequestNumber: selectedPullRequest?.number ?? null,
    selectedPullRequest: diffSource === "pr" ? selectedPullRequest : null,
    selectedPullRequestComments: diffSource === "pr" ? gitPullRequestComments : [],
    selectedPullRequestCommentsLoading: gitPullRequestCommentsLoading,
    selectedPullRequestCommentsError: gitPullRequestCommentsError,
    onSelectPullRequest: (pullRequest) => {
      setSelectedCommitSha(null);
      handleSelectPullRequest(pullRequest);
    },
    onSelectCommit: (entry) => {
      handleSelectCommit(entry.sha);
    },
    gitRemoteUrl,
    gitRoot: activeGitRoot,
    gitRootCandidates,
    gitRootScanDepth,
    gitRootScanLoading,
    gitRootScanError,
    gitRootScanHasScanned,
    onGitRootScanDepthChange: setGitRootScanDepth,
    onScanGitRoots: scanGitRoots,
    onSelectGitRoot: (path) => {
      void handleSetGitRoot(path);
    },
    onClearGitRoot: () => {
      void handleSetGitRoot(null);
    },
    onPickGitRoot: handlePickGitRoot,
    onStageGitAll: handleStageGitAll,
    onStageGitFile: handleStageGitFile,
    onUnstageGitFile: handleUnstageGitFile,
    onRevertGitFile: handleRevertGitFile,
    onRevertAllGitChanges: handleRevertAllGitChanges,
    gitDiffs: activeDiffs,
    gitDiffLoading: activeDiffLoading,
    gitDiffError: activeDiffError,
    onDiffActivePathChange: handleActiveDiffPath,
    commitMessage,
    commitMessageLoading,
    commitMessageError,
    onCommitMessageChange: handleCommitMessageChange,
    onGenerateCommitMessage: handleGenerateCommitMessage,
    onCommit: handleCommit,
    onCommitAndPush: handleCommitAndPush,
    onCommitAndSync: handleCommitAndSync,
    onPush: handlePush,
    onSync: handleSync,
    commitLoading,
    pushLoading,
    syncLoading,
    commitError,
    pushError,
    syncError,
    commitsAhead: gitLogAhead,
    onSendPrompt: handleSendPrompt,
    onSendPromptToNewAgent: handleSendPromptToNewAgent,
    onCreatePrompt: handleCreatePrompt,
    onUpdatePrompt: handleUpdatePrompt,
    onDeletePrompt: handleDeletePrompt,
    onMovePrompt: handleMovePrompt,
    onRevealWorkspacePrompts: handleRevealWorkspacePrompts,
    onRevealGeneralPrompts: handleRevealGeneralPrompts,
    canRevealGeneralPrompts: Boolean(activeWorkspace),
    onSend: handleComposerSend,
    onQueue: handleComposerQueue,
    onStop: interruptTurn,
    canStop: canInterrupt,
    isReviewing,
    isProcessing,
    steerEnabled: appSettings.experimentalSteerEnabled,
    activeTokenUsage,
    activeQueue,
    draftText: activeDraft,
    onDraftChange: handleDraftChange,
    activeImages,
    onPickImages: pickImages,
    onAttachImages: attachImages,
    onRemoveImage: removeImage,
    prefillDraft,
    onPrefillHandled: (id) => {
      if (prefillDraft?.id === id) {
        setPrefillDraft(null);
      }
    },
    insertText: composerInsert,
    onInsertHandled: (id) => {
      if (composerInsert?.id === id) {
        setComposerInsert(null);
      }
    },
    onEditQueued: handleEditQueued,
    onDeleteQueued: handleDeleteQueued,
    collaborationModes,
    selectedCollaborationModeId,
    onSelectCollaborationMode: setSelectedCollaborationModeId,
    models,
    selectedModelId,
    onSelectModel: setSelectedModelId,
    reasoningOptions,
    selectedEffort,
    onSelectEffort: setSelectedEffort,
    reasoningSupported,
    accessMode,
    onSelectAccessMode: setAccessMode,
    skills,
    prompts,
    files,
    onInsertComposerText: handleInsertComposerText,
    textareaRef: composerInputRef,
    composerEditorSettings,
    composerEditorExpanded,
    onToggleComposerEditorExpanded: toggleComposerEditorExpanded,
    composerSendBehavior: appSettings.composerSendBehavior,
    composerSendConfirmationEnabled: appSettings.composerSendConfirmationEnabled,
    composerTargetLabel,
    composerCopyLabel: otherDraftLabel,
    onCopyComposerDraft: otherDraftLabel ? handleCopyOtherDraft : undefined,
    dictationEnabled: appSettings.dictationEnabled && dictationReady,
    dictationState,
    dictationLevel,
    onToggleDictation: handleToggleDictation,
    dictationTranscript,
    onDictationTranscriptHandled: (id) => {
      clearDictationTranscript(id);
    },
    dictationError,
    onDismissDictationError: clearDictationError,
    dictationHint,
    onDismissDictationHint: clearDictationHint,
    composerSendLabel,
    showComposer,
    plan: activePlan,
    debugEntries,
    nanobotLogEntries,
    logPanelMode,
    logPanelTitle,
    logPanelEmptyText,
    debugOpen,
    terminalOpen,
    terminalTabs,
    activeTerminalId,
    onSelectTerminal,
    onNewTerminal,
    onCloseTerminal,
    terminalState,
    onClearDebug: clearDebugEntries,
    onCopyDebug: handleCopyDebug,
    onClearNanobotLog: clearNanobotLogEntries,
    onCopyNanobotLog: copyNanobotLogEntries,
    onResizeDebug: onDebugPanelResizeStart,
    onResizeTerminal: onTerminalPanelResizeStart,
    onBackFromDiff: () => {
      setSelectedDiffPath(null);
      setCenterMode("chat");
    },
    onGoProjects: () => setActiveTab("projects"),
    workspaceDropTargetRef,
    isWorkspaceDropActive: dropOverlayActive,
    workspaceDropText: dropOverlayText,
    onWorkspaceDragOver: handleWorkspaceDragOver,
    onWorkspaceDragEnter: handleWorkspaceDragEnter,
    onWorkspaceDragLeave: handleWorkspaceDragLeave,
    onWorkspaceDrop: handleWorkspaceDrop,
  });

  const workspaceHomeNode = activeWorkspace ? (
    <WorkspaceHome
      workspace={activeWorkspace}
      runs={workspaceRuns}
      recentThreadInstances={recentThreadInstances}
      recentThreadsUpdatedAt={recentThreadsUpdatedAt}
      prompt={workspacePrompt}
      onPromptChange={setWorkspacePrompt}
      onStartRun={startWorkspaceRun}
      runMode={workspaceRunMode}
      onRunModeChange={setWorkspaceRunMode}
      models={models}
      selectedModelId={selectedModelId}
      onSelectModel={setSelectedModelId}
      modelSelections={workspaceModelSelections}
      onToggleModel={toggleWorkspaceModelSelection}
      onModelCountChange={setWorkspaceModelCount}
      error={workspaceRunError}
      isSubmitting={workspaceRunSubmitting}
      activeWorkspaceId={activeWorkspaceId}
      activeThreadId={activeThreadId}
      threadStatusById={threadStatusById}
      onSelectInstance={handleSelectWorkspaceInstance}
      skills={skills}
      prompts={prompts}
      files={files}
      dictationEnabled={appSettings.dictationEnabled && dictationReady}
      dictationState={dictationState}
      dictationLevel={dictationLevel}
      onToggleDictation={handleToggleDictation}
      onOpenDictationSettings={() => openSettings("dictation")}
      dictationError={dictationError}
      onDismissDictationError={clearDictationError}
      dictationHint={dictationHint}
      onDismissDictationHint={clearDictationHint}
      dictationTranscript={dictationTranscript}
      onDictationTranscriptHandled={clearDictationTranscript}
      agentMdContent={agentMdContent}
      agentMdExists={agentMdExists}
      agentMdTruncated={agentMdTruncated}
      agentMdLoading={agentMdLoading}
      agentMdSaving={agentMdSaving}
      agentMdError={agentMdError}
      agentMdDirty={agentMdDirty}
      onAgentMdChange={setAgentMdContent}
      onAgentMdRefresh={() => {
        void refreshAgentMd();
      }}
      onAgentMdSave={() => {
        void saveAgentMd();
      }}
    />
  ) : null;

  const mainMessagesNode = showWorkspaceHome ? workspaceHomeNode : messagesNode;

  const desktopTopbarLeftNodeWithToggle =
    logTabActive
      ? null
      : !isCompact ? (
          <div className="topbar-leading">
            <SidebarTrigger className="-ml-1" data-tauri-drag-region="false" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            {desktopTopbarLeftNode}
          </div>
        ) : (
          desktopTopbarLeftNode
        );

  const showThreadTabs = !isCompact && threadTabs.length > 0;
  useEffect(() => {
    if (!showThreadTabs) {
      handleTopbarOverridesChange(null);
    }
  }, [handleTopbarOverridesChange, showThreadTabs]);
  const threadTabsBarNode = showThreadTabs ? (
    <ThreadTabsBar
      tabs={threadTabs}
      activeTabId={activeThreadTabId}
      onSelectTab={(tabId) => {
        const tab = threadTabs.find((entry) => entry.id === tabId);
        if (tab?.kind === "home") {
          setHomeView(true);
          selectHomeAction();
        } else {
          setHomeView(false);
        }
        setActiveThreadTabId(tabId);
      }}
      onCloseTab={handleCloseThreadTab}
      onReorderTab={reorderThreadTabs}
      onRenameThread={handleRenameThread}
    />
  ) : null;

  const threadTabsNode = showThreadTabs ? (
    <ThreadTabsContent
      tabs={threadTabs}
      activeTabId={activeThreadTabId}
      activeWorkspaceId={activeWorkspaceId}
      workspaceHomeNode={workspaceHomeNode}
      workspacesById={workspacesById}
      itemsByThread={itemsByThread}
      threadStatusById={threadStatusById}
      planByThread={planByThread}
      userInputRequests={userInputRequests}
      happyEnabled={happyEnabled}
      happyMessageStatusById={happyMessageStatusById}
      happyMessageIdByItemId={happyMessageIdByItemId}
      codeBlockCopyUseModifier={appSettings.composerCodeBlockCopyUseModifier}
      openAppTargets={appSettings.openAppTargets}
      openAppIconById={openAppIconById}
      selectedOpenAppId={appSettings.selectedOpenAppId}
      onSelectOpenAppId={handleSelectOpenAppId}
      onUserInputSubmit={handleUserInputSubmit}
      onDebug={addDebugEntry}
      isCompact={isCompact}
      isTablet={isTablet}
      activeTab={activeTab}
      tabletTab={tabletTab}
      setActiveTab={setActiveTab}
      onRightPanelResizeStart={onRightPanelResizeStart}
      onPlanPanelResizeStart={onPlanPanelResizeStart}
      connectWorkspace={connectWorkspace}
      startThreadForWorkspace={startThreadForWorkspace}
      sendUserMessageToThread={sendUserMessageToThread}
      onRetryHappyMessage={retryHappyMessage}
      handleSend={handleSend}
      queueMessage={queueMessage}
      clearActiveImages={clearActiveImages}
      setPrefillDraft={setPrefillDraft}
      onSendPromptToNewAgent={handleSendPromptToNewAgent}
      onSendPrompt={handleSendPrompt}
      onInsertComposerText={handleInsertComposerText}
      updateWorkspaceSettings={updateWorkspaceSettings}
      onError={alertError}
      onComposerOverridesChange={handleComposerOverridesChange}
      onTopbarOverridesChange={handleTopbarOverridesChange}
      debugEntries={debugEntries}
      nanobotLogEntries={nanobotLogEntries}
      debugLogTitle={debugLogTitle}
      nanobotLogTitle={nanobotLogTitle}
      debugLogEmptyText={debugLogEmptyText}
      nanobotLogEmptyText={nanobotLogEmptyText}
      onClearDebug={clearDebugEntries}
      onCopyDebug={handleCopyDebug}
      onClearNanobotLog={clearNanobotLogEntries}
      onCopyNanobotLog={copyNanobotLogEntries}
    />
  ) : null;

  const threadTabsHeight = showThreadTabs ? "36px" : "0px";
  const mainTopbarHeight = "45px";

  return (
    <I18nProvider language={appSettings.language}>
      <div
        className={appClassName}
        style={
          {
            "--sidebar-width": `${
              isCompact ? sidebarWidth : sidebarColumnWidth
            }px`,
            "--right-panel-width": `${
              isCompact ? rightPanelWidth : rightPanelCollapsed ? 0 : rightPanelWidth
            }px`,
            "--plan-panel-height": `${planPanelHeight}px`,
            "--terminal-panel-height": `${terminalPanelHeight}px`,
            "--debug-panel-height": `${debugPanelHeight}px`,
            "--thread-tabs-height": threadTabsHeight,
            "--main-topbar-height": mainTopbarHeight,
            "--ui-font-family": appSettings.uiFontFamily,
            "--code-font-family": appSettings.codeFontFamily,
            "--code-font-size": `${appSettings.codeFontSize}px`
          } as React.CSSProperties
        }
      >
        <div className="drag-strip" id="titlebar" data-tauri-drag-region />
        {shouldLoadGitHubPanelData ? (
          <Suspense fallback={null}>
            <GitHubPanelData
              activeWorkspace={activeWorkspace}
              gitPanelMode={gitPanelMode}
              shouldLoadDiffs={shouldLoadDiffs}
              diffSource={diffSource}
              selectedPullRequestNumber={selectedPullRequest?.number ?? null}
              onIssuesChange={handleGitIssuesChange}
              onPullRequestsChange={handleGitPullRequestsChange}
              onPullRequestDiffsChange={handleGitPullRequestDiffsChange}
              onPullRequestCommentsChange={handleGitPullRequestCommentsChange}
            />
          </Suspense>
        ) : null}
        <AppLayout
          isPhone={isPhone}
          isTablet={isTablet}
          sidebarWidth={sidebarColumnWidth}
          sidebarCollapsed={sidebarCollapsed}
          onSidebarOpenChange={(open) => {
            if (open) {
              expandSidebar();
            } else {
              collapseSidebar();
            }
          }}
          showHome={showHome}
          showGitDetail={showGitDetail}
          activeTab={activeTab}
          tabletTab={tabletTab}
          centerMode={centerMode}
          hasActivePlan={hasActivePlan}
          activeWorkspace={Boolean(activeWorkspace) || logTabActive}
          sidebarNode={sidebarNode}
          messagesNode={mainMessagesNode}
          composerNode={composerNode}
          approvalToastsNode={approvalToastsNode}
          updateToastNode={updateToastNode}
          errorToastsNode={errorToastsNode}
          homeNode={homeNode}
          mainHeaderNode={mainHeaderNode}
          desktopTopbarLeftNode={desktopTopbarLeftNodeWithToggle}
          threadTabsBarNode={threadTabsBarNode}
          threadTabsNode={threadTabsNode}
          tabletNavNode={tabletNavNode}
          tabBarNode={tabBarNode}
          gitDiffPanelNode={gitDiffPanelNode}
          gitDiffViewerNode={gitDiffViewerNode}
          planPanelNode={planPanelNode}
          debugPanelNode={debugPanelNode}
          debugPanelFullNode={debugPanelFullNode}
          terminalDockNode={terminalDockNode}
          compactEmptyCodexNode={compactEmptyCodexNode}
          compactEmptyGitNode={compactEmptyGitNode}
          compactGitBackNode={compactGitBackNode}
          onSidebarResizeStart={onSidebarResizeStart}
          onRightPanelResizeStart={onRightPanelResizeStart}
          onPlanPanelResizeStart={onPlanPanelResizeStart}
        />
        <AppModals
          renamePrompt={renamePrompt}
          onRenamePromptChange={handleRenamePromptChange}
          onRenamePromptCancel={handleRenamePromptCancel}
          onRenamePromptConfirm={handleRenamePromptConfirm}
          worktreePrompt={worktreePrompt}
          onWorktreePromptChange={updateWorktreeBranch}
          onWorktreeSetupScriptChange={updateWorktreeSetupScript}
          onWorktreePromptCancel={cancelWorktreePrompt}
          onWorktreePromptConfirm={confirmWorktreePrompt}
          clonePrompt={clonePrompt}
          onClonePromptCopyNameChange={updateCloneCopyName}
          onClonePromptChooseCopiesFolder={chooseCloneCopiesFolder}
          onClonePromptUseSuggestedFolder={useSuggestedCloneCopiesFolder}
          onClonePromptClearCopiesFolder={clearCloneCopiesFolder}
          onClonePromptCancel={cancelClonePrompt}
          onClonePromptConfirm={confirmClonePrompt}
          settingsOpen={settingsOpen}
          settingsSection={settingsSection ?? undefined}
          onCloseSettings={closeSettings}
          SettingsViewComponent={SettingsView}
          settingsProps={{
            workspaceGroups,
            groupedWorkspaces,
            ungroupedLabel,
            onMoveWorkspace: handleMoveWorkspace,
            onDeleteWorkspace: (workspaceId) => {
              void removeWorkspace(workspaceId);
            },
            onCreateWorkspaceGroup: createWorkspaceGroup,
            onRenameWorkspaceGroup: renameWorkspaceGroup,
            onMoveWorkspaceGroup: moveWorkspaceGroup,
            onDeleteWorkspaceGroup: deleteWorkspaceGroup,
            onAssignWorkspaceGroup: assignWorkspaceGroup,
            reduceTransparency,
            onToggleTransparency: setReduceTransparency,
            appSettings,
            openAppIconById,
            onUpdateAppSettings: async (next) => {
              await queueSaveSettings(next);
            },
            onRunDoctor: doctor,
            onGetNanobotConfigPath: getNanobotConfigPath,
            onTestNanobotDingTalk: testNanobotDingTalk,
            onUpdateWorkspaceCodexBin: async (id, codexBin) => {
              await updateWorkspaceCodexBin(id, codexBin);
            },
            onUpdateWorkspaceSettings: async (id, settings) => {
              await updateWorkspaceSettings(id, settings);
            },
            scaleShortcutTitle,
            scaleShortcutText,
            onTestNotificationSound: handleTestNotificationSound,
            dictationModelStatus: dictationModel.status,
            onDownloadDictationModel: dictationModel.download,
            onCancelDictationDownload: dictationModel.cancel,
            onRemoveDictationModel: dictationModel.remove,
          }}
        />
      </div>
    </I18nProvider>
  );
}

function App() {
  const windowLabel = useWindowLabel();
  if (windowLabel === "about") {
    return (
      <DebugErrorBoundary>
        <Suspense fallback={null}>
          <AboutView />
        </Suspense>
      </DebugErrorBoundary>
    );
  }
  return (
    <DebugErrorBoundary>
      <MainApp />
    </DebugErrorBoundary>
  );
}

export default App;
