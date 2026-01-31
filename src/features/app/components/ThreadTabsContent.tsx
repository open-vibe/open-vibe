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
import type { ThreadTab } from "../hooks/useThreadTabs";
import { ThreadTabView } from "./ThreadTabView";
import { useEffect, useMemo, type MouseEvent } from "react";
import type { ThreadTopbarOverrides } from "../types/threadTabs";

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

type ThreadTabsContentProps = {
  tabs: ThreadTab[];
  activeTabId: string | null;
  workspacesById: Map<string, WorkspaceInfo>;
  itemsByThread: Record<string, ConversationItem[]>;
  threadStatusById: Record<string, ThreadActivityStatus>;
  planByThread: Record<string, TurnPlan | null>;
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
  onComposerOverridesChange?: (overrides: ComposerOverrides | null) => void;
  onTopbarOverridesChange?: (overrides: ThreadTopbarOverrides | null) => void;
};

export function ThreadTabsContent({
  tabs,
  activeTabId,
  workspacesById,
  itemsByThread,
  threadStatusById,
  planByThread,
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
}: ThreadTabsContentProps) {
  const activeThreadTab = useMemo(
    () => (activeTabId ? tabs.find((tab) => tab.id === activeTabId) ?? null : null),
    [activeTabId, tabs],
  );

  useEffect(() => {
    if (!onComposerOverridesChange) {
      return;
    }
    if (!activeThreadTab) {
      onComposerOverridesChange(null);
    }
  }, [activeThreadTab, onComposerOverridesChange]);

  useEffect(() => {
    if (!onTopbarOverridesChange) {
      return;
    }
    if (!activeThreadTab) {
      onTopbarOverridesChange(null);
    }
  }, [activeThreadTab, onTopbarOverridesChange]);

  if (!tabs.length) {
    return null;
  }

  return (
    <>
      {tabs.map((tab) => {
        const workspace = workspacesById.get(tab.workspaceId);
        if (!workspace) {
          return null;
        }
        const parentWorkspace = workspace.parentId
          ? workspacesById.get(workspace.parentId) ?? null
          : null;
        const items = itemsByThread[tab.threadId] ?? [];
        const plan = planByThread[tab.threadId] ?? null;
        const threadStatus = threadStatusById[tab.threadId] ?? null;
        const isActive = tab.id === activeTabId;
        return (
          <ThreadTabView
            key={tab.id}
            tabId={tab.id}
            workspace={workspace}
            parentWorkspace={parentWorkspace}
            threadId={tab.threadId}
            isActive={isActive}
            items={items}
            threadStatus={threadStatus}
            plan={plan}
            userInputRequests={userInputRequests}
            codeBlockCopyUseModifier={codeBlockCopyUseModifier}
            openAppTargets={openAppTargets}
            openAppIconById={openAppIconById}
            selectedOpenAppId={selectedOpenAppId}
            onSelectOpenAppId={onSelectOpenAppId}
            onUserInputSubmit={onUserInputSubmit}
            onDebug={onDebug}
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
            handleSend={handleSend}
            queueMessage={queueMessage}
            clearActiveImages={clearActiveImages}
            setPrefillDraft={setPrefillDraft}
            onSendPromptToNewAgent={onSendPromptToNewAgent}
            onSendPrompt={onSendPrompt}
            onInsertComposerText={onInsertComposerText}
            updateWorkspaceSettings={updateWorkspaceSettings}
            onError={onError}
            onComposerOverridesChange={
              isActive ? onComposerOverridesChange ?? undefined : undefined
            }
            onTopbarOverridesChange={
              isActive ? onTopbarOverridesChange ?? undefined : undefined
            }
          />
        );
      })}
    </>
  );
}
