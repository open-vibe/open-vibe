import { Suspense, lazy, useCallback, useEffect, useRef, type MouseEvent } from "react";
import type {
  ConversationItem,
  DebugEntry,
  OpenAppTarget,
  RequestUserInputRequest,
  RequestUserInputResponse,
  TurnPlan,
  WorkspaceInfo,
  WorkspaceSettings,
} from "../../../types";
import { Messages } from "../../messages/components/Messages";
import { GitDiffPanel } from "../../git/components/GitDiffPanel";
import { GitDiffViewer } from "../../git/components/GitDiffViewer";
import { FileTreePanel } from "../../files/components/FileTreePanel";
import { PromptPanel } from "../../prompts/components/PromptPanel";
import { PlanPanel } from "../../plan/components/PlanPanel";
import { useGitPanelController } from "../hooks/useGitPanelController";
import { useGitHubPanelController } from "../hooks/useGitHubPanelController";
import { useGitRemote } from "../../git/hooks/useGitRemote";
import { useGitRepoScan } from "../../git/hooks/useGitRepoScan";
import { useGitActions } from "../../git/hooks/useGitActions";
import { useGitCommitController } from "../hooks/useGitCommitController";
import { useWorkspaceFiles } from "../../workspaces/hooks/useWorkspaceFiles";
import { useCustomPrompts } from "../../prompts/hooks/useCustomPrompts";
import { useAutoExitEmptyDiff } from "../../git/hooks/useAutoExitEmptyDiff";
import { useSyncSelectedDiffPath } from "../hooks/useSyncSelectedDiffPath";
import { usePullRequestComposer } from "../../git/hooks/usePullRequestComposer";
import { isMissingGitRepoError } from "../../../utils/gitErrors";
import { pickWorkspacePath } from "../../../services/tauri";
import { cn } from "@/lib/utils";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import type { ThreadTopbarOverrides } from "../types/threadTabs";

const GitHubPanelData = lazy(() =>
  import("../../git/components/GitHubPanelData").then((module) => ({
    default: module.GitHubPanelData,
  })),
);

type ThreadActivityStatus = {
  isProcessing: boolean;
  hasUnread: boolean;
  isReviewing: boolean;
  processingStartedAt?: number | null;
  lastDurationMs?: number | null;
};

type ComposerOverrides = {
  sendLabel?: string;
  onSend: (text: string, images: string[]) => void | Promise<void>;
  onQueue: (text: string, images: string[]) => void | Promise<void>;
};

type ThreadTabViewProps = {
  tabId: string;
  workspace: WorkspaceInfo;
  parentWorkspace: WorkspaceInfo | null;
  threadId: string;
  isActive: boolean;
  items: ConversationItem[];
  threadStatus: ThreadActivityStatus | null;
  plan: TurnPlan | null;
  userInputRequests: RequestUserInputRequest[];
  codeBlockCopyUseModifier: boolean;
  openAppTargets: OpenAppTarget[];
  openAppIconById: Record<string, string>;
  selectedOpenAppId: string;
  onSelectOpenAppId: (id: string) => void;
  onUserInputSubmit: (
    request: RequestUserInputRequest,
    response: RequestUserInputResponse,
  ) => void;
  onDebug?: (entry: DebugEntry) => void;
  isCompact: boolean;
  isTablet: boolean;
  activeTab: "projects" | "codex" | "git" | "log";
  tabletTab: "codex" | "git" | "log";
  setActiveTab: (tab: "projects" | "codex" | "git" | "log") => void;
  onRightPanelResizeStart: (event: MouseEvent<HTMLDivElement>) => void;
  onPlanPanelResizeStart: (event: MouseEvent<HTMLDivElement>) => void;
  connectWorkspace: (workspace: WorkspaceInfo) => Promise<void>;
  startThreadForWorkspace: (
    workspaceId: string,
    options?: { activate?: boolean },
  ) => Promise<string | null>;
  sendUserMessageToThread: (
    workspace: WorkspaceInfo,
    threadId: string,
    text: string,
    images?: string[],
    options?: { model?: string | null; effort?: string | null },
  ) => Promise<void>;
  handleSend: (text: string, images: string[]) => Promise<void>;
  queueMessage: (text: string, images: string[]) => Promise<void>;
  clearActiveImages: () => void;
  setPrefillDraft: (draft: { id: string; text: string; createdAt: number }) => void;
  onSendPromptToNewAgent: (text: string) => Promise<void>;
  onSendPrompt: (text: string) => void;
  onInsertComposerText: (text: string) => void;
  updateWorkspaceSettings: (
    workspaceId: string,
    settings: Partial<WorkspaceSettings>,
  ) => Promise<WorkspaceInfo>;
  onError: (error: unknown) => void;
  onComposerOverridesChange?: (overrides: ComposerOverrides) => void;
  onTopbarOverridesChange?: (overrides: ThreadTopbarOverrides) => void;
};

export function ThreadTabView({
  tabId,
  workspace,
  parentWorkspace,
  threadId,
  isActive,
  items,
  threadStatus,
  plan,
  userInputRequests,
  codeBlockCopyUseModifier,
  openAppTargets,
  openAppIconById,
  selectedOpenAppId,
  onSelectOpenAppId,
  onUserInputSubmit,
  onDebug,
  isCompact,
  isTablet,
  activeTab,
  tabletTab,
  setActiveTab,
  onRightPanelResizeStart,
  onPlanPanelResizeStart,
  connectWorkspace,
  startThreadForWorkspace,
  sendUserMessageToThread,
  handleSend,
  queueMessage,
  clearActiveImages,
  setPrefillDraft,
  onSendPromptToNewAgent,
  onSendPrompt,
  onInsertComposerText,
  updateWorkspaceSettings,
  onError,
  onComposerOverridesChange,
  onTopbarOverridesChange,
}: ThreadTabViewProps) {
  const diffLayerRef = useRef<HTMLDivElement | null>(null);
  const chatLayerRef = useRef<HTMLDivElement | null>(null);
  const isWorktreeWorkspace = workspace.kind === "worktree";
  const worktreeApplyTitle = parentWorkspace?.name
    ? `Apply changes to ${parentWorkspace.name}`
    : "Apply changes to parent workspace";

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
    diffSource,
    setDiffSource,
    gitStatus,
    refreshGitStatus,
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
  } = useGitPanelController({
    activeWorkspace: workspace,
    isCompact,
    isTablet,
    activeTab,
    tabletTab,
    setActiveTab,
    prDiffs: gitPullRequestDiffs,
    prDiffsLoading: gitPullRequestDiffsLoading,
    prDiffsError: gitPullRequestDiffsError,
    enabled: isActive,
  });

  const shouldLoadGitHubPanelData =
    isActive &&
    (gitPanelMode === "issues" ||
      gitPanelMode === "prs" ||
      (shouldLoadDiffs && diffSource === "pr"));

  const { remote: gitRemoteUrl } = useGitRemote(workspace, isActive);
  const {
    repos: gitRootCandidates,
    isLoading: gitRootScanLoading,
    error: gitRootScanError,
    depth: gitRootScanDepth,
    hasScanned: gitRootScanHasScanned,
    scan: scanGitRoots,
    setDepth: setGitRootScanDepth,
    clear: clearGitRootCandidates,
  } = useGitRepoScan(workspace, isActive);

  const {
    prompts,
    createPrompt,
    updatePrompt,
    deletePrompt,
    movePrompt,
    getWorkspacePromptsDir,
    getGlobalPromptsDir,
  } = useCustomPrompts({ activeWorkspace: workspace, onDebug, enabled: isActive });

  const { files, isLoading: isFilesLoading } = useWorkspaceFiles({
    activeWorkspace: workspace,
    onDebug,
    enabled: isActive,
  });

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
    activeWorkspace: workspace,
    onRefreshGitStatus: refreshGitStatus,
    onRefreshGitDiffs: refreshGitDiffs,
    onError,
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
    activeWorkspace: workspace,
    activeWorkspaceId: workspace.id,
    activeWorkspaceIdRef,
    gitStatus,
    refreshGitStatus,
    refreshGitLog,
  });

  const fileStatus = gitStatus.error
    ? isMissingGitRepoError(gitStatus.error)
      ? "No git repository"
      : "Git status unavailable"
    : gitStatus.files.length > 0
      ? `${gitStatus.files.length} file${
          gitStatus.files.length === 1 ? "" : "s"
        } changed`
      : "Working tree clean";

  const normalizePath = useCallback((value: string) => {
    return value.replace(/\\/g, "/").replace(/\/+$/, "");
  }, []);

  const handleSetGitRoot = useCallback(
    async (path: string | null) => {
      await updateWorkspaceSettings(workspace.id, {
        gitRoot: path,
      });
      clearGitRootCandidates();
      refreshGitStatus();
    },
    [clearGitRootCandidates, refreshGitStatus, updateWorkspaceSettings, workspace.id],
  );

  const handlePickGitRoot = useCallback(async () => {
    const selection = await pickWorkspacePath();
    if (!selection) {
      return;
    }
    const workspacePath = normalizePath(workspace.path);
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
  }, [handleSetGitRoot, normalizePath, workspace.path]);

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
        onError(error);
      }
    },
    [createPrompt, onError],
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
        onError(error);
      }
    },
    [onError, updatePrompt],
  );

  const handleDeletePrompt = useCallback(
    async (path: string) => {
      try {
        await deletePrompt(path);
      } catch (error) {
        onError(error);
      }
    },
    [deletePrompt, onError],
  );

  const handleMovePrompt = useCallback(
    async (data: { path: string; scope: "workspace" | "global" }) => {
      try {
        await movePrompt(data);
      } catch (error) {
        onError(error);
      }
    },
    [movePrompt, onError],
  );

  const handleRevealWorkspacePrompts = useCallback(async () => {
    try {
      const path = await getWorkspacePromptsDir();
      await revealItemInDir(path);
    } catch (error) {
      onError(error);
    }
  }, [getWorkspacePromptsDir, onError]);

  const handleRevealGeneralPrompts = useCallback(async () => {
    try {
      const path = await getGlobalPromptsDir();
      if (!path) {
        return;
      }
      await revealItemInDir(path);
    } catch (error) {
      onError(error);
    }
  }, [getGlobalPromptsDir, onError]);

  const handleExitDiff = useCallback(() => {
    setCenterMode("chat");
    setSelectedDiffPath(null);
  }, [setCenterMode, setSelectedDiffPath]);

  useSyncSelectedDiffPath({
    diffSource,
    centerMode,
    gitPullRequestDiffs,
    gitCommitDiffs,
    selectedDiffPath,
    setSelectedDiffPath,
  });

  useAutoExitEmptyDiff({
    centerMode,
    autoExitEnabled: diffSource === "local",
    activeDiffCount: activeDiffs.length,
    activeDiffLoading,
    activeDiffError,
    activeThreadId: threadId,
    isCompact,
    setCenterMode,
    setSelectedDiffPath,
    setActiveTab,
  });

  const {
    handleSelectPullRequest,
    composerSendLabel,
    handleComposerSend,
    handleComposerQueue,
  } = usePullRequestComposer({
    activeWorkspace: workspace,
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

  useEffect(() => {
    if (!onComposerOverridesChange || !isActive) {
      return;
    }
    onComposerOverridesChange({
      sendLabel: composerSendLabel,
      onSend: handleComposerSend,
      onQueue: handleComposerQueue,
    });
  }, [composerSendLabel, handleComposerQueue, handleComposerSend, isActive, onComposerOverridesChange]);

  useEffect(() => {
    if (!onTopbarOverridesChange || !isActive) {
      return;
    }
    onTopbarOverridesChange({
      centerMode,
      gitDiffViewStyle,
      onSelectDiffViewStyle: setGitDiffViewStyle,
      onExitDiff: handleExitDiff,
    });
  }, [
    centerMode,
    gitDiffViewStyle,
    handleExitDiff,
    isActive,
    onTopbarOverridesChange,
    setGitDiffViewStyle,
  ]);

  useEffect(() => {
    const diffLayer = diffLayerRef.current;
    const chatLayer = chatLayerRef.current;

    if (diffLayer) {
      if (centerMode === "diff") {
        diffLayer.removeAttribute("inert");
      } else {
        diffLayer.setAttribute("inert", "");
      }
    }

    if (chatLayer) {
      if (centerMode === "chat") {
        chatLayer.removeAttribute("inert");
      } else {
        chatLayer.setAttribute("inert", "");
      }
    }

    const hiddenLayer = centerMode === "diff" ? chatLayer : diffLayer;
    const activeElement = document.activeElement;
    if (
      hiddenLayer &&
      activeElement instanceof HTMLElement &&
      hiddenLayer.contains(activeElement)
    ) {
      activeElement.blur();
    }
  }, [centerMode]);

  const hasActivePlan = Boolean(plan && (plan.steps.length > 0 || plan.explanation));

  const gitDiffPanelNode = (() => {
    if (filePanelMode === "files") {
      return (
        <FileTreePanel
          workspaceId={workspace.id}
          workspacePath={workspace.path}
          files={files}
          isLoading={isFilesLoading}
          filePanelMode={filePanelMode}
          onFilePanelModeChange={setFilePanelMode}
          onInsertText={onInsertComposerText}
          openTargets={openAppTargets}
          openAppIconById={openAppIconById}
          selectedOpenAppId={selectedOpenAppId}
          onSelectOpenAppId={onSelectOpenAppId}
        />
      );
    }
    if (filePanelMode === "prompts") {
      return (
        <PromptPanel
          prompts={prompts}
          workspacePath={workspace.path}
          filePanelMode={filePanelMode}
          onFilePanelModeChange={setFilePanelMode}
          onSendPrompt={onSendPrompt}
          onSendPromptToNewAgent={onSendPromptToNewAgent}
          onCreatePrompt={handleCreatePrompt}
          onUpdatePrompt={handleUpdatePrompt}
          onDeletePrompt={handleDeletePrompt}
          onMovePrompt={handleMovePrompt}
          onRevealWorkspacePrompts={handleRevealWorkspacePrompts}
          onRevealGeneralPrompts={handleRevealGeneralPrompts}
          canRevealGeneralPrompts={Boolean(workspace)}
        />
      );
    }
    const sidebarSelectedDiffPath = centerMode === "diff" ? selectedDiffPath : null;
    return (
      <GitDiffPanel
        mode={gitPanelMode}
        onModeChange={handleGitPanelModeChange}
        filePanelMode={filePanelMode}
        onFilePanelModeChange={setFilePanelMode}
        worktreeApplyLabel="apply"
        worktreeApplyTitle={isWorktreeWorkspace ? worktreeApplyTitle : null}
        worktreeApplyLoading={isWorktreeWorkspace ? worktreeApplyLoading : false}
        worktreeApplyError={isWorktreeWorkspace ? worktreeApplyError : null}
        worktreeApplySuccess={isWorktreeWorkspace ? worktreeApplySuccess : false}
        onApplyWorktreeChanges={
          isWorktreeWorkspace ? handleApplyWorktreeChanges : undefined
        }
        branchName={gitStatus.branchName || "unknown"}
        totalAdditions={gitStatus.totalAdditions}
        totalDeletions={gitStatus.totalDeletions}
        fileStatus={fileStatus}
        error={gitStatus.error}
        logError={gitLogError}
        logLoading={gitLogLoading}
        stagedFiles={gitStatus.stagedFiles}
        unstagedFiles={gitStatus.unstagedFiles}
        onSelectFile={handleSelectDiff}
        selectedPath={sidebarSelectedDiffPath}
        logEntries={gitLogEntries}
        logTotal={gitLogTotal}
        logAhead={gitLogAhead}
        logBehind={gitLogBehind}
        logAheadEntries={gitLogAheadEntries}
        logBehindEntries={gitLogBehindEntries}
        logUpstream={gitLogUpstream}
        selectedCommitSha={selectedCommitSha}
        onSelectCommit={(entry) => handleSelectCommit(entry.sha)}
        issues={gitIssues}
        issuesTotal={gitIssuesTotal}
        issuesLoading={gitIssuesLoading}
        issuesError={gitIssuesError}
        pullRequests={gitPullRequests}
        pullRequestsTotal={gitPullRequestsTotal}
        pullRequestsLoading={gitPullRequestsLoading}
        pullRequestsError={gitPullRequestsError}
        selectedPullRequest={selectedPullRequest?.number ?? null}
        onSelectPullRequest={handleSelectPullRequest}
        gitRemoteUrl={gitRemoteUrl}
        gitRoot={workspace.settings.gitRoot ?? null}
        gitRootCandidates={gitRootCandidates}
        gitRootScanDepth={gitRootScanDepth}
        gitRootScanLoading={gitRootScanLoading}
        gitRootScanError={gitRootScanError}
        gitRootScanHasScanned={gitRootScanHasScanned}
        onGitRootScanDepthChange={setGitRootScanDepth}
        onScanGitRoots={scanGitRoots}
        onSelectGitRoot={handleSetGitRoot}
        onClearGitRoot={() => {
          void handleSetGitRoot(null);
        }}
        onPickGitRoot={handlePickGitRoot}
        onStageAllChanges={handleStageGitAll}
        onStageFile={handleStageGitFile}
        onUnstageFile={handleUnstageGitFile}
        onRevertFile={handleRevertGitFile}
        onRevertAllChanges={handleRevertAllGitChanges}
        commitMessage={commitMessage}
        commitMessageLoading={commitMessageLoading}
        commitMessageError={commitMessageError}
        onCommitMessageChange={handleCommitMessageChange}
        onGenerateCommitMessage={handleGenerateCommitMessage}
        onCommit={handleCommit}
        onCommitAndPush={handleCommitAndPush}
        onCommitAndSync={handleCommitAndSync}
        onPush={handlePush}
        onSync={handleSync}
        commitLoading={commitLoading}
        pushLoading={pushLoading}
        syncLoading={syncLoading}
        commitError={commitError}
        pushError={pushError}
        syncError={syncError}
        commitsAhead={gitLogAhead}
      />
    );
  })();

  return (
    <div
      className={cn("thread-tab-view", !isActive && "is-hidden")}
      data-tab-id={tabId}
    >
      {shouldLoadGitHubPanelData ? (
        <Suspense fallback={null}>
          <GitHubPanelData
            activeWorkspace={workspace}
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
      <div className="content">
        <div
          className={`content-layer ${centerMode === "diff" ? "is-active" : "is-hidden"}`}
          aria-hidden={centerMode !== "diff"}
          ref={diffLayerRef}
        >
          <GitDiffViewer
            diffs={activeDiffs}
            selectedPath={selectedDiffPath}
            scrollRequestId={diffScrollRequestId}
            isLoading={activeDiffLoading}
            error={activeDiffError}
            diffStyle={gitDiffViewStyle}
            pullRequest={diffSource === "pr" ? selectedPullRequest : null}
            pullRequestComments={
              diffSource === "pr" ? gitPullRequestComments : []
            }
            pullRequestCommentsLoading={gitPullRequestCommentsLoading}
            pullRequestCommentsError={gitPullRequestCommentsError}
            onActivePathChange={handleActiveDiffPath}
          />
        </div>
        <div
          className={`content-layer ${centerMode === "chat" ? "is-active" : "is-hidden"}`}
          aria-hidden={centerMode !== "chat"}
          ref={chatLayerRef}
        >
          <Messages
            items={items}
            threadId={threadId}
            workspaceId={workspace.id}
            workspacePath={workspace.path}
            openTargets={openAppTargets}
            selectedOpenAppId={selectedOpenAppId}
            codeBlockCopyUseModifier={codeBlockCopyUseModifier}
            userInputRequests={userInputRequests}
            onUserInputSubmit={onUserInputSubmit}
            isThinking={threadStatus?.isProcessing ?? false}
            processingStartedAt={threadStatus?.processingStartedAt ?? null}
            lastDurationMs={threadStatus?.lastDurationMs ?? null}
          />
        </div>
      </div>
      <div
        className="right-panel-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize right panel"
        onMouseDown={onRightPanelResizeStart}
      />
      <div className={`right-panel ${hasActivePlan ? "" : "plan-collapsed"}`}>
        <div className="right-panel-top">{gitDiffPanelNode}</div>
        <div
          className="right-panel-divider"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize plan panel"
          onMouseDown={onPlanPanelResizeStart}
        />
        <div className="right-panel-bottom">
          <PlanPanel
            plan={plan}
            isProcessing={threadStatus?.isProcessing ?? false}
          />
        </div>
      </div>
    </div>
  );
}
