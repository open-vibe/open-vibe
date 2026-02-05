import { useCallback, useEffect, useReducer, useRef } from "react";
import * as Sentry from "@sentry/react";
import type {
  CustomPromptOption,
  DebugEntry,
  HappyBridgeCommand,
  WorkspaceInfo,
} from "../../../types";
import { useAppServerEvents } from "../../app/hooks/useAppServerEvents";
import { getThreadTokenUsage, sendHappyBridgeCommand } from "../../../services/tauri";
import { initialState, threadReducer } from "./useThreadsReducer";
import { useThreadStorage } from "./useThreadStorage";
import { useThreadLinking } from "./useThreadLinking";
import { useThreadEventHandlers } from "./useThreadEventHandlers";
import { useThreadActions } from "./useThreadActions";
import { useThreadMessaging } from "./useThreadMessaging";
import { useThreadApprovals } from "./useThreadApprovals";
import { useThreadRateLimits } from "./useThreadRateLimits";
import { useThreadSelectors } from "./useThreadSelectors";
import { useThreadStatus } from "./useThreadStatus";
import { useThreadUserInput } from "./useThreadUserInput";
import {
  makeCustomNameKey,
  removeCustomName,
  saveCustomName,
} from "../utils/threadStorage";
import { normalizeTokenUsage } from "../utils/threadNormalize";

type UseThreadsOptions = {
  activeWorkspace: WorkspaceInfo | null;
  onWorkspaceConnected: (id: string) => void;
  onDebug?: (entry: DebugEntry) => void;
  model?: string | null;
  effort?: string | null;
  collaborationMode?: Record<string, unknown> | null;
  accessMode?: "read-only" | "current" | "full-access";
  steerEnabled?: boolean;
  resumeStreamingEnabled?: boolean;
  customPrompts?: CustomPromptOption[];
  onMessageActivity?: () => void;
  happyEnabled?: boolean;
  getWorkspacePath?: (workspaceId: string) => string | null;
};

export function useThreads({
  activeWorkspace,
  onWorkspaceConnected,
  onDebug,
  model,
  effort,
  collaborationMode,
  accessMode,
  steerEnabled = false,
  resumeStreamingEnabled = false,
  customPrompts = [],
  onMessageActivity,
  happyEnabled = false,
  getWorkspacePath,
}: UseThreadsOptions) {
  const [state, dispatch] = useReducer(threadReducer, initialState);
  const loadedThreadsRef = useRef<Record<string, boolean>>({});
  const replaceOnResumeRef = useRef<Record<string, boolean>>({});
  const pendingInterruptsRef = useRef<Set<string>>(new Set());
  const threadWorkspaceByIdRef = useRef<Map<string, string>>(new Map());
  const { approvalAllowlistRef, handleApprovalDecision, handleApprovalRemember } =
    useThreadApprovals({ dispatch, onDebug });
  const { handleUserInputSubmit } = useThreadUserInput({ dispatch });
  const {
    customNamesRef,
    threadActivityRef,
    pinnedThreadsVersion,
    getCustomName,
    recordThreadActivity,
    pinThread,
    unpinThread,
    isThreadPinned,
    getPinTimestamp,
  } = useThreadStorage();
  void pinnedThreadsVersion;

  const activeWorkspaceId = activeWorkspace?.id ?? null;
  const { activeThreadId, activeItems } = useThreadSelectors({
    activeWorkspaceId,
    activeThreadIdByWorkspace: state.activeThreadIdByWorkspace,
    itemsByThread: state.itemsByThread,
  });
  const activeTokenUsage = activeThreadId
    ? state.tokenUsageByThread[activeThreadId] ?? null
    : null;

  const { refreshAccountRateLimits } = useThreadRateLimits({
    activeWorkspaceId,
    activeWorkspaceConnected: activeWorkspace?.connected,
    dispatch,
    onDebug,
  });

  const { markProcessing, markReviewing, setActiveTurnId } = useThreadStatus({
    dispatch,
  });

  const queueHappyBridgeCommand = useCallback(
    async (command: HappyBridgeCommand) => {
      if (!happyEnabled) {
        return;
      }
      if ("threadId" in command && "workspaceId" in command) {
        threadWorkspaceByIdRef.current.set(command.threadId, command.workspaceId);
      }
      try {
        await sendHappyBridgeCommand(command);
      } catch {
        // Ignore bridge errors to avoid breaking local chat flow.
      }
    },
    [happyEnabled],
  );

  const pushThreadErrorMessage = useCallback(
    (threadId: string, message: string) => {
      dispatch({
        type: "addAssistantMessage",
        threadId,
        text: message,
      });
      if (threadId !== activeThreadId) {
        dispatch({ type: "markUnread", threadId, hasUnread: true });
      }
    },
    [activeThreadId, dispatch],
  );

  const refreshThreadTokenUsage = useCallback(
    async (workspaceId: string, threadId: string) => {
      if (!workspaceId || !threadId) {
        return;
      }
      try {
        const tokenUsageRaw = await getThreadTokenUsage(workspaceId, threadId);
        if (!tokenUsageRaw || typeof tokenUsageRaw !== "object") {
          return;
        }
        dispatch({
          type: "setThreadTokenUsage",
          threadId,
          tokenUsage: normalizeTokenUsage(
            tokenUsageRaw as Record<string, unknown>,
          ),
        });
      } catch (error) {
        // Ignore usage fetch errors to avoid disrupting chat UI.
        void error;
      }
    },
    [dispatch],
  );

  useEffect(() => {
    if (!activeWorkspaceId || !activeThreadId) {
      return;
    }
    if (activeTokenUsage) {
      return;
    }
    void refreshThreadTokenUsage(activeWorkspaceId, activeThreadId);
  }, [
    activeTokenUsage,
    activeThreadId,
    activeWorkspaceId,
    refreshThreadTokenUsage,
  ]);

  const safeMessageActivity = useCallback(() => {
    try {
      void onMessageActivity?.();
    } catch {
      // Ignore refresh errors to avoid breaking the UI.
    }
  }, [onMessageActivity]);
  const { applyCollabThreadLinks, applyCollabThreadLinksFromThread } =
    useThreadLinking({
      dispatch,
      threadParentById: state.threadParentById,
    });

  const handleWorkspaceConnected = useCallback(
    (workspaceId: string) => {
      onWorkspaceConnected(workspaceId);
      void refreshAccountRateLimits(workspaceId);
    },
    [onWorkspaceConnected, refreshAccountRateLimits],
  );

  const handlers = useThreadEventHandlers({
    activeThreadId,
    dispatch,
    getCustomName,
    markProcessing,
    markReviewing,
    setActiveTurnId,
    safeMessageActivity,
    recordThreadActivity,
    pushThreadErrorMessage,
    onDebug,
    onWorkspaceConnected: handleWorkspaceConnected,
    getWorkspacePath,
    onHappyBridgeCommand: queueHappyBridgeCommand,
    applyCollabThreadLinks,
    approvalAllowlistRef,
    pendingInterruptsRef,
    refreshThreadTokenUsage,
  });

  useAppServerEvents(handlers);

  const {
    startThreadForWorkspace,
    resumeThreadForWorkspace,
    refreshThread,
    resetWorkspaceThreads,
    listThreadsForWorkspace,
    loadOlderThreadsForWorkspace,
    archiveThread,
  } = useThreadActions({
    dispatch,
    itemsByThread: state.itemsByThread,
    threadsByWorkspace: state.threadsByWorkspace,
    activeThreadIdByWorkspace: state.activeThreadIdByWorkspace,
    threadListCursorByWorkspace: state.threadListCursorByWorkspace,
    threadStatusById: state.threadStatusById,
    onDebug,
    getCustomName,
    threadActivityRef,
    loadedThreadsRef,
    replaceOnResumeRef,
    applyCollabThreadLinksFromThread,
    refreshThreadTokenUsage,
    resumeStreamingEnabled,
  });

  const startThread = useCallback(async () => {
    if (!activeWorkspaceId) {
      return null;
    }
    return startThreadForWorkspace(activeWorkspaceId);
  }, [activeWorkspaceId, startThreadForWorkspace]);

  const ensureThreadForActiveWorkspace = useCallback(async () => {
    if (!activeWorkspace) {
      return null;
    }
    let threadId = activeThreadId;
    if (!threadId) {
      threadId = await startThreadForWorkspace(activeWorkspace.id);
      if (!threadId) {
        return null;
      }
    } else if (!loadedThreadsRef.current[threadId]) {
      await resumeThreadForWorkspace(activeWorkspace.id, threadId);
    }
    return threadId;
  }, [activeWorkspace, activeThreadId, resumeThreadForWorkspace, startThreadForWorkspace]);

  const {
    interruptTurn,
    sendUserMessage,
    sendUserMessageToThread,
    startReview,
  } = useThreadMessaging({
    activeWorkspace,
    activeThreadId,
    accessMode,
    model,
    effort,
    collaborationMode,
    steerEnabled,
    customPrompts,
    threadStatusById: state.threadStatusById,
    activeTurnIdByThread: state.activeTurnIdByThread,
    pendingInterruptsRef,
    dispatch,
    getCustomName,
    markProcessing,
    markReviewing,
    setActiveTurnId,
    recordThreadActivity,
    safeMessageActivity,
    onDebug,
    pushThreadErrorMessage,
    ensureThreadForActiveWorkspace,
    onHappyBridgeCommand: queueHappyBridgeCommand,
  });

  const setActiveThreadId = useCallback(
    (threadId: string | null, workspaceId?: string) => {
      const targetId = workspaceId ?? activeWorkspaceId;
      if (!targetId) {
        return;
      }
      const currentThreadId = state.activeThreadIdByWorkspace[targetId] ?? null;
      dispatch({ type: "setActiveThreadId", workspaceId: targetId, threadId });
      if (threadId && currentThreadId !== threadId) {
        Sentry.metrics.count("thread_switched", 1, {
          attributes: {
            workspace_id: targetId,
            thread_id: threadId,
            reason: "select",
          },
        });
      }
      if (threadId) {
        void resumeThreadForWorkspace(targetId, threadId);
      }
    },
    [activeWorkspaceId, resumeThreadForWorkspace, state.activeThreadIdByWorkspace],
  );

  const removeThread = useCallback(
    (workspaceId: string, threadId: string) => {
      unpinThread(workspaceId, threadId);
      dispatch({ type: "removeThread", workspaceId, threadId });
      void archiveThread(workspaceId, threadId);
    },
    [archiveThread, unpinThread],
  );

  const renameThread = useCallback(
    (workspaceId: string, threadId: string, newName: string) => {
      const trimmed = newName.trim();
      const key = makeCustomNameKey(workspaceId, threadId);
      if (!trimmed) {
        const existing = customNamesRef.current[key];
        if (!existing) {
          return;
        }
        removeCustomName(workspaceId, threadId);
        delete customNamesRef.current[key];
        dispatch({
          type: "setThreadName",
          workspaceId,
          threadId,
          name: `Agent ${threadId.slice(0, 4)}`,
        });
        void refreshThread(workspaceId, threadId);
        return;
      }
      saveCustomName(workspaceId, threadId, trimmed);
      customNamesRef.current[key] = trimmed;
      dispatch({
        type: "setThreadName",
        workspaceId,
        threadId,
        name: trimmed,
      });
    },
    [customNamesRef, dispatch, refreshThread],
  );

  const getWorkspaceIdForThread = useCallback(
    (threadId: string) => {
      const mappedWorkspaceId = threadWorkspaceByIdRef.current.get(threadId);
      if (mappedWorkspaceId) {
        return mappedWorkspaceId;
      }
      for (const [workspaceId, threads] of Object.entries(
        state.threadsByWorkspace,
      )) {
        if (threads.some((thread) => thread.id === threadId)) {
          threadWorkspaceByIdRef.current.set(threadId, workspaceId);
          return workspaceId;
        }
      }
      return activeWorkspaceId;
    },
    [activeWorkspaceId, state.threadsByWorkspace],
  );

  return {
    activeThreadId,
    setActiveThreadId,
    getWorkspaceIdForThread,
    activeItems,
    itemsByThread: state.itemsByThread,
    approvals: state.approvals,
    userInputRequests: state.userInputRequests,
    threadsByWorkspace: state.threadsByWorkspace,
    threadParentById: state.threadParentById,
    threadStatusById: state.threadStatusById,
    threadListLoadingByWorkspace: state.threadListLoadingByWorkspace,
    threadListPagingByWorkspace: state.threadListPagingByWorkspace,
    threadListCursorByWorkspace: state.threadListCursorByWorkspace,
    activeTurnIdByThread: state.activeTurnIdByThread,
    tokenUsageByThread: state.tokenUsageByThread,
    rateLimitsByWorkspace: state.rateLimitsByWorkspace,
    planByThread: state.planByThread,
    lastAgentMessageByThread: state.lastAgentMessageByThread,
    refreshAccountRateLimits,
    interruptTurn,
    removeThread,
    pinThread,
    unpinThread,
    isThreadPinned,
    getPinTimestamp,
    renameThread,
    startThread,
    startThreadForWorkspace,
    listThreadsForWorkspace,
    refreshThread,
    resetWorkspaceThreads,
    loadOlderThreadsForWorkspace,
    sendUserMessage,
    sendUserMessageToThread,
    startReview,
    handleApprovalDecision,
    handleApprovalRemember,
    handleUserInputSubmit,
  };
}
