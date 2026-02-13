import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import * as Sentry from "@sentry/react";
import type {
  CustomPromptOption,
  DebugEntry,
  HappyBridgeCommand,
  NanobotBridgeCommand,
  WorkspaceInfo,
} from "../../../types";
import { useAppServerEvents } from "../../app/hooks/useAppServerEvents";
import {
  getThreadTokenUsage,
  sendHappyBridgeCommand,
  sendNanobotBridgeCommand,
} from "../../../services/tauri";
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
import { useHappyBridgeSync } from "../../happy/hooks/useHappyBridgeSync";
import {
  makeCustomNameKey,
  removeCustomName,
  saveCustomName,
  saveThreadSummariesForWorkspace,
} from "../utils/threadStorage";
import { normalizeTokenUsage } from "../utils/threadNormalize";

const NANOBOT_SESSION_STATE_STORAGE_KEY = "openvibe.nanobot.sessionState.v1";
const NANOBOT_THREAD_IDS_STORAGE_KEY = "openvibe.nanobot.threadIds.v1";
const NANOBOT_AGENT_THREAD_PREFIX = "nanobot-agent:";

function readPersistedNanobotThreadIds(workspaceId: string) {
  if (typeof window === "undefined") {
    return new Set<string>();
  }
  try {
    const raw = window.localStorage.getItem(NANOBOT_THREAD_IDS_STORAGE_KEY);
    if (!raw) {
      return new Set<string>();
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const entries = parsed[workspaceId];
    if (!Array.isArray(entries)) {
      return new Set<string>();
    }
    return new Set(
      entries
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean),
    );
  } catch {
    return new Set<string>();
  }
}

function hasPersistedNanobotRoute(workspaceId: string, threadId: string) {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const raw = window.localStorage.getItem(NANOBOT_SESSION_STATE_STORAGE_KEY);
    if (!raw) {
      return false;
    }
    const parsed = JSON.parse(raw) as {
      routes?: Record<string, { workspaceId?: string; threadId?: string }>;
    };
    return Object.values(parsed.routes ?? {}).some(
      (route) =>
        route?.workspaceId === workspaceId &&
        typeof route.threadId === "string" &&
        route.threadId.trim() === threadId,
    );
  } catch {
    return false;
  }
}

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
  nanobotBridgeEnabled?: boolean;
  getWorkspacePath?: (workspaceId: string) => string | null;
  isNanobotWorkspaceId?: (workspaceId: string) => boolean;
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
  nanobotBridgeEnabled = false,
  getWorkspacePath,
  isNanobotWorkspaceId,
}: UseThreadsOptions) {
  const [state, dispatch] = useReducer(threadReducer, initialState);
  const [happyConnected, setHappyConnected] = useState(false);
  const loadedThreadsRef = useRef<Record<string, boolean>>({});
  const replaceOnResumeRef = useRef<Record<string, boolean>>({});
  const pendingInterruptsRef = useRef<Set<string>>(new Set());
  const threadWorkspaceByIdRef = useRef<Map<string, string>>(new Map());
  const happyMessageCommandsRef = useRef<
    Map<
      string,
      Extract<HappyBridgeCommand, { type: "thread-message" }> & {
        messageId: string;
      }
    >
  >(new Map());
  const pendingHappyUserMessagesRef = useRef<
    Map<string, { messageId: string; content: string }[]>
  >(new Map());
  const happyMessageIdByItemRef = useRef<Record<string, string>>({});
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
      let trackedMessageId: string | null = null;
      let commandToSend = command;
      if (command.type === "thread-message") {
        const messageId =
          command.messageId ??
          `happy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        trackedMessageId = messageId;
        commandToSend = { ...command, messageId };
        happyMessageCommandsRef.current.set(messageId, {
          ...command,
          messageId,
        });
        dispatch({
          type: "registerHappyMessage",
          messageId,
          status: "pending",
          timestamp: Date.now(),
        });
        if (command.role === "user") {
          const queue = pendingHappyUserMessagesRef.current.get(command.threadId) ?? [];
          queue.push({ messageId, content: command.content });
          pendingHappyUserMessagesRef.current.set(command.threadId, queue);
        } else if (!happyMessageIdByItemRef.current[messageId]) {
          happyMessageIdByItemRef.current[messageId] = messageId;
          dispatch({
            type: "mapHappyMessageToItem",
            itemId: messageId,
            messageId,
          });
        }
      }
      try {
        await sendHappyBridgeCommand(commandToSend);
      } catch (error) {
        if (trackedMessageId) {
          dispatch({
            type: "setHappyMessageStatus",
            messageId: trackedMessageId,
            status: "failed",
            timestamp: Date.now(),
            reason: error instanceof Error ? error.message : String(error),
          });
        }
        // Ignore bridge errors to avoid breaking local chat flow.
      }
    },
    [happyEnabled, dispatch],
  );

  const mapHappyMessageToItem = useCallback(
    (threadId: string, itemId: string, text: string) => {
      if (happyMessageIdByItemRef.current[itemId]) {
        return;
      }
      const queue = pendingHappyUserMessagesRef.current.get(threadId);
      if (!queue || queue.length === 0) {
        return;
      }
      const normalized = text.trim();
      let index = queue.findIndex(
        (entry) => entry.content.trim() === normalized,
      );
      if (index < 0) {
        index = 0;
      }
      const [entry] = queue.splice(index, 1);
      if (queue.length === 0) {
        pendingHappyUserMessagesRef.current.delete(threadId);
      } else {
        pendingHappyUserMessagesRef.current.set(threadId, queue);
      }
      happyMessageIdByItemRef.current[itemId] = entry.messageId;
      dispatch({
        type: "mapHappyMessageToItem",
        itemId,
        messageId: entry.messageId,
      });
    },
    [dispatch],
  );

  const retryHappyMessage = useCallback(
    async (messageId: string) => {
      if (!happyEnabled) {
        return;
      }
      const command = happyMessageCommandsRef.current.get(messageId);
      if (!command) {
        return;
      }
      dispatch({
        type: "setHappyMessageStatus",
        messageId,
        status: "pending",
        timestamp: Date.now(),
      });
      try {
        await sendHappyBridgeCommand(command);
      } catch (error) {
        dispatch({
          type: "setHappyMessageStatus",
          messageId,
          status: "failed",
          timestamp: Date.now(),
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [dispatch, happyEnabled],
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

  useHappyBridgeSync({
    enabled: happyEnabled,
    onStatus: (connected) => {
      setHappyConnected(connected);
    },
    onMessageSync: (event) => {
      dispatch({
        type: "setHappyMessageStatus",
        messageId: event.messageId,
        status: event.status === "success" ? "success" : "failed",
        timestamp: Date.now(),
        reason: event.reason,
      });
    },
  });

  useEffect(() => {
    if (!happyEnabled) {
      setHappyConnected(false);
    }
  }, [happyEnabled]);
  const queueNanobotBridgeCommand = useCallback(
    async (command: NanobotBridgeCommand) => {
      if (!nanobotBridgeEnabled) {
        return;
      }
      try {
        await sendNanobotBridgeCommand(command);
      } catch {
        // Ignore bridge failures to avoid breaking local chat flow.
      }
    },
    [nanobotBridgeEnabled],
  );
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
  const shouldEnsureThread = useCallback(
    (workspaceId: string, threadId: string) => {
      if (!threadId.trim()) {
        return false;
      }
      if (!isNanobotWorkspaceId?.(workspaceId)) {
        return true;
      }
      if (threadId.startsWith(NANOBOT_AGENT_THREAD_PREFIX)) {
        return true;
      }
      const existing = state.threadsByWorkspace[workspaceId] ?? [];
      if (existing.some((thread) => thread.id === threadId)) {
        return true;
      }
      const persistedIds = readPersistedNanobotThreadIds(workspaceId);
      if (persistedIds.has(threadId)) {
        return true;
      }
      return hasPersistedNanobotRoute(workspaceId, threadId);
    },
    [isNanobotWorkspaceId, state.threadsByWorkspace],
  );

  const handlers = useThreadEventHandlers({
    activeThreadId,
    dispatch,
    shouldEnsureThread,
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
    onNanobotBridgeCommand: queueNanobotBridgeCommand,
    onUserMessageItem: mapHappyMessageToItem,
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
    async (workspaceId: string, threadId: string) => {
      const archived = await archiveThread(workspaceId, threadId);
      if (!archived) {
        return false;
      }
      unpinThread(workspaceId, threadId);
      dispatch({ type: "removeThread", workspaceId, threadId });
      const nextThreads = (state.threadsByWorkspace[workspaceId] ?? []).filter(
        (thread) => thread.id !== threadId,
      );
      saveThreadSummariesForWorkspace(workspaceId, nextThreads);
      return true;
    },
    [archiveThread, state.threadsByWorkspace, unpinThread],
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
    happyMessageStatusById: state.happyMessageStatusById,
    happyMessageIdByItemId: state.happyMessageIdByItemId,
    happyConnected,
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
    retryHappyMessage,
    startReview,
    handleApprovalDecision,
    handleApprovalRemember,
    handleUserInputSubmit,
  };
}
