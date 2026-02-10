import type {
  ConversationItem,
  DebugEntry,
  HappyMessageSyncState,
  OpenAppTarget,
  RequestUserInputRequest,
  RequestUserInputResponse,
  TurnPlan,
  WorkspaceInfo,
  WorkspaceSettings,
} from "../../../types";
import { cn } from "@/lib/utils";
import type { ThreadTab } from "../hooks/useThreadTabs";
import { ThreadTabView } from "./ThreadTabView";
import { useEffect, useMemo, type MouseEvent, type ReactNode } from "react";
import type { ThreadTopbarOverrides } from "../types/threadTabs";
import { LogTabPage } from "../../debug/components/LogTabPage";

type ThreadActivityStatus = {
  isProcessing: boolean;
  hasUnread: boolean;
  isReviewing: boolean;
  isLoading: boolean;
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
  activeWorkspaceId: string | null;
  workspaceHomeNode: ReactNode;
  workspacesById: Map<string, WorkspaceInfo>;
  itemsByThread: Record<string, ConversationItem[]>;
  threadStatusById: Record<string, ThreadActivityStatus>;
  planByThread: Record<string, TurnPlan | null>;
  userInputRequests: RequestUserInputRequest[];
  happyEnabled: boolean;
  happyMessageStatusById: Record<string, HappyMessageSyncState>;
  happyMessageIdByItemId: Record<string, string>;
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
  onRetryHappyMessage: (messageId: string) => void;
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
  debugEntries: DebugEntry[];
  nanobotLogEntries: DebugEntry[];
  debugLogTitle: string;
  nanobotLogTitle: string;
  debugLogEmptyText: string;
  nanobotLogEmptyText: string;
  onClearDebug: () => void;
  onCopyDebug: () => void;
  onClearNanobotLog: () => void;
  onCopyNanobotLog: () => void;
};

export function ThreadTabsContent({
  tabs,
  activeTabId,
  activeWorkspaceId,
  workspaceHomeNode,
  workspacesById,
  itemsByThread,
  threadStatusById,
  planByThread,
  userInputRequests,
  happyEnabled,
  happyMessageStatusById,
  happyMessageIdByItemId,
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
  onRetryHappyMessage,
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
  debugEntries,
  nanobotLogEntries,
  debugLogTitle,
  nanobotLogTitle,
  debugLogEmptyText,
  nanobotLogEmptyText,
  onClearDebug,
  onCopyDebug,
  onClearNanobotLog,
  onCopyNanobotLog,
}: ThreadTabsContentProps) {
  const activeThreadTab = useMemo(
    () => (activeTabId ? tabs.find((tab) => tab.id === activeTabId) ?? null : null),
    [activeTabId, tabs],
  );

  useEffect(() => {
    if (!onComposerOverridesChange) {
      return;
    }
    if (!activeThreadTab || activeThreadTab.kind !== "thread") {
      onComposerOverridesChange(null);
    }
  }, [activeThreadTab, onComposerOverridesChange]);

  useEffect(() => {
    if (!onTopbarOverridesChange) {
      return;
    }
    if (!activeThreadTab || activeThreadTab.kind !== "thread") {
      onTopbarOverridesChange(null);
    }
  }, [activeThreadTab, onTopbarOverridesChange]);

  if (!tabs.length) {
    return null;
  }

  return (
    <>
      {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const shouldRender = isActive || tab.loaded;
          if (!shouldRender) {
            return null;
          }
          if (tab.kind === "debug-log") {
            return (
              <div
                key={tab.id}
                className={cn("thread-tab-view", !isActive && "is-hidden")}
                data-tab-id={tab.id}
              >
                <LogTabPage
                  title={debugLogTitle}
                  emptyText={debugLogEmptyText}
                  entries={debugEntries}
                  onClear={onClearDebug}
                  onCopy={onCopyDebug}
                />
              </div>
            );
          }
          if (tab.kind === "nanobot-log") {
            return (
              <div
                key={tab.id}
                className={cn("thread-tab-view", !isActive && "is-hidden")}
                data-tab-id={tab.id}
              >
                <LogTabPage
                  title={nanobotLogTitle}
                  emptyText={nanobotLogEmptyText}
                  entries={nanobotLogEntries}
                  onClear={onClearNanobotLog}
                  onCopy={onCopyNanobotLog}
                />
              </div>
            );
          }
          if (tab.kind === "workspace") {
            const workspace = workspacesById.get(tab.workspaceId);
            if (!workspace) {
              return null;
            }
            return (
              <div
                key={tab.id}
                className={cn("thread-tab-view", !isActive && "is-hidden")}
                data-tab-id={tab.id}
              >
                {isActive && activeWorkspaceId === tab.workspaceId
                  ? workspaceHomeNode
                  : null}
              </div>
            );
          }
          if (tab.kind !== "thread") {
            return null;
          }
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
            happyEnabled={happyEnabled}
            happyMessageStatusById={happyMessageStatusById}
            happyMessageIdByItemId={happyMessageIdByItemId}
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
            onRetryHappyMessage={onRetryHappyMessage}
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
