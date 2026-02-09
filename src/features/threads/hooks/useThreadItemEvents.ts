import { useCallback, useRef } from "react";
import type { Dispatch } from "react";
import { buildConversationItem } from "../../../utils/threadItems";
import { asString } from "../utils/threadNormalize";
import type {
  ConversationItem,
  HappyBridgeCommand,
  NanobotBridgeCommand,
} from "../../../types";
import type { ThreadAction } from "./useThreadsReducer";

type UseThreadItemEventsOptions = {
  activeThreadId: string | null;
  dispatch: Dispatch<ThreadAction>;
  getCustomName: (workspaceId: string, threadId: string) => string | undefined;
  markProcessing: (threadId: string, isProcessing: boolean) => void;
  markReviewing: (threadId: string, isReviewing: boolean) => void;
  safeMessageActivity: () => void;
  recordThreadActivity: (
    workspaceId: string,
    threadId: string,
    timestamp?: number,
  ) => void;
  getWorkspacePath?: (workspaceId: string) => string | null;
  onHappyBridgeCommand?: (command: HappyBridgeCommand) => void;
  onNanobotBridgeCommand?: (command: NanobotBridgeCommand) => void;
  onUserMessageItem?: (
    workspaceId: string,
    threadId: string,
    itemId: string,
    text: string,
  ) => void;
  applyCollabThreadLinks: (
    threadId: string,
    item: Record<string, unknown>,
  ) => void;
};

export function useThreadItemEvents({
  activeThreadId,
  dispatch,
  getCustomName,
  markProcessing,
  markReviewing,
  safeMessageActivity,
  recordThreadActivity,
  getWorkspacePath,
  onHappyBridgeCommand,
  onNanobotBridgeCommand,
  onUserMessageItem,
  applyCollabThreadLinks,
}: UseThreadItemEventsOptions) {
  const agentMessageBufferRef = useRef<Record<string, string>>({});
  const historyStreamRef = useRef<
    Record<string, { streamId: string; items: ConversationItem[] }>
  >({});

  const mergeAgentDelta = useCallback((existing: string, delta: string) => {
    if (!delta) {
      return existing;
    }
    if (!existing) {
      return delta;
    }
    if (delta.startsWith(existing)) {
      return delta;
    }
    if (existing.startsWith(delta)) {
      return existing;
    }
    return `${existing}${delta}`;
  }, []);
  const handleItemUpdate = useCallback(
    (
      workspaceId: string,
      threadId: string,
      item: Record<string, unknown>,
      shouldMarkProcessing: boolean,
    ) => {
      dispatch({ type: "ensureThread", workspaceId, threadId });
      if (shouldMarkProcessing) {
        markProcessing(threadId, true);
      }
      applyCollabThreadLinks(threadId, item);
      const itemType = asString(item?.type ?? "");
      if (itemType === "enteredReviewMode") {
        markReviewing(threadId, true);
      } else if (itemType === "exitedReviewMode") {
        markReviewing(threadId, false);
        markProcessing(threadId, false);
      }
      const converted = buildConversationItem(item);
      if (converted) {
        dispatch({
          type: "upsertItem",
          workspaceId,
          threadId,
          item: converted,
          hasCustomName: Boolean(getCustomName(workspaceId, threadId)),
        });
        if (converted.kind === "message" && converted.role === "user") {
          onUserMessageItem?.(
            workspaceId,
            threadId,
            converted.id,
            converted.text,
          );
        }
      }
      safeMessageActivity();
    },
    [
      applyCollabThreadLinks,
      dispatch,
      getCustomName,
      markProcessing,
      markReviewing,
      onUserMessageItem,
      safeMessageActivity,
    ],
  );

  const handleToolOutputDelta = useCallback(
    (threadId: string, itemId: string, delta: string) => {
      markProcessing(threadId, true);
      dispatch({ type: "appendToolOutput", threadId, itemId, delta });
      safeMessageActivity();
    },
    [dispatch, markProcessing, safeMessageActivity],
  );

  const handleTerminalInteraction = useCallback(
    (threadId: string, itemId: string, stdin: string) => {
      if (!stdin) {
        return;
      }
      const normalized = stdin.replace(/\r\n/g, "\n");
      const suffix = normalized.endsWith("\n") ? "" : "\n";
      handleToolOutputDelta(threadId, itemId, `\n[stdin]\n${normalized}${suffix}`);
    },
    [handleToolOutputDelta],
  );

  const onAgentMessageDelta = useCallback(
    ({
      workspaceId,
      threadId,
      itemId,
      delta,
    }: {
      workspaceId: string;
      threadId: string;
      itemId: string;
      delta: string;
    }) => {
      agentMessageBufferRef.current[itemId] = mergeAgentDelta(
        agentMessageBufferRef.current[itemId] ?? "",
        delta,
      );
      dispatch({ type: "ensureThread", workspaceId, threadId });
      markProcessing(threadId, true);
      const hasCustomName = Boolean(getCustomName(workspaceId, threadId));
      dispatch({
        type: "appendAgentDelta",
        workspaceId,
        threadId,
        itemId,
        delta,
        hasCustomName,
      });
    },
    [dispatch, getCustomName, markProcessing, mergeAgentDelta],
  );

  const onAgentMessageCompleted = useCallback(
    ({
      workspaceId,
      threadId,
      itemId,
      text,
    }: {
      workspaceId: string;
      threadId: string;
      itemId: string;
      text: string;
    }) => {
      const timestamp = Date.now();
      const bufferedText = agentMessageBufferRef.current[itemId] ?? "";
      const resolvedText = text.trim() ? text : bufferedText;
      delete agentMessageBufferRef.current[itemId];
      dispatch({ type: "ensureThread", workspaceId, threadId });
      const hasCustomName = Boolean(getCustomName(workspaceId, threadId));
      dispatch({
        type: "completeAgentMessage",
        workspaceId,
        threadId,
        itemId,
        text: resolvedText,
        hasCustomName,
      });
      dispatch({
        type: "setThreadTimestamp",
        workspaceId,
        threadId,
        timestamp,
      });
      dispatch({
        type: "setLastAgentMessage",
        threadId,
        text: resolvedText,
        timestamp,
      });
      if (onHappyBridgeCommand && resolvedText.trim()) {
        const workspacePath = getWorkspacePath?.(workspaceId) ?? "";
        const threadName = getCustomName(workspaceId, threadId) ?? null;
        onHappyBridgeCommand({
          type: "thread-message",
          messageId: itemId,
          threadId,
          workspaceId,
          workspacePath,
          threadName,
          role: "assistant",
          content: resolvedText,
          createdAt: timestamp,
        });
      }
      if (onNanobotBridgeCommand && resolvedText.trim()) {
        onNanobotBridgeCommand({
          type: "thread-message",
          messageId: itemId,
          threadId,
          role: "assistant",
          content: resolvedText,
        });
      }
      markProcessing(threadId, false);
      recordThreadActivity(workspaceId, threadId, timestamp);
      safeMessageActivity();
      if (threadId !== activeThreadId) {
        dispatch({ type: "markUnread", threadId, hasUnread: true });
      }
    },
    [
      activeThreadId,
      dispatch,
      getCustomName,
      getWorkspacePath,
      onHappyBridgeCommand,
      onNanobotBridgeCommand,
      markProcessing,
      recordThreadActivity,
      safeMessageActivity,
    ],
  );

  const onItemStarted = useCallback(
    (workspaceId: string, threadId: string, item: Record<string, unknown>) => {
      handleItemUpdate(workspaceId, threadId, item, true);
    },
    [handleItemUpdate],
  );

  const onItemCompleted = useCallback(
    (workspaceId: string, threadId: string, item: Record<string, unknown>) => {
      handleItemUpdate(workspaceId, threadId, item, false);
    },
    [handleItemUpdate],
  );

  const onReasoningSummaryDelta = useCallback(
    (_workspaceId: string, threadId: string, itemId: string, delta: string) => {
      dispatch({ type: "appendReasoningSummary", threadId, itemId, delta });
    },
    [dispatch],
  );

  const onReasoningTextDelta = useCallback(
    (_workspaceId: string, threadId: string, itemId: string, delta: string) => {
      dispatch({ type: "appendReasoningContent", threadId, itemId, delta });
    },
    [dispatch],
  );

  const onCommandOutputDelta = useCallback(
    (_workspaceId: string, threadId: string, itemId: string, delta: string) => {
      handleToolOutputDelta(threadId, itemId, delta);
    },
    [handleToolOutputDelta],
  );

  const onTerminalInteraction = useCallback(
    (_workspaceId: string, threadId: string, itemId: string, stdin: string) => {
      handleTerminalInteraction(threadId, itemId, stdin);
    },
    [handleTerminalInteraction],
  );

  const onFileChangeOutputDelta = useCallback(
    (_workspaceId: string, threadId: string, itemId: string, delta: string) => {
      handleToolOutputDelta(threadId, itemId, delta);
    },
    [handleToolOutputDelta],
  );

  const onThreadHistoryChunk = useCallback(
    (
      workspaceId: string,
      threadId: string,
      streamId: string,
      items: ConversationItem[],
    ) => {
      if (!items.length) {
        return;
      }
      const existing = historyStreamRef.current[threadId];
      if (!existing || existing.streamId !== streamId) {
        historyStreamRef.current[threadId] = {
          streamId,
          items: [...items],
        };
      } else {
        existing.items.push(...items);
      }
      const nextItems = historyStreamRef.current[threadId].items;
      dispatch({ type: "ensureThread", workspaceId, threadId });
      dispatch({ type: "setThreadItems", threadId, items: nextItems });
      dispatch({ type: "setThreadLoading", threadId, isLoading: false });
      safeMessageActivity();
    },
    [dispatch, safeMessageActivity],
  );

  const onThreadHistoryCompleted = useCallback(
    (threadId: string, streamId: string) => {
      const existing = historyStreamRef.current[threadId];
      if (existing && existing.streamId === streamId) {
        delete historyStreamRef.current[threadId];
      }
    },
    [],
  );

  return {
    onAgentMessageDelta,
    onAgentMessageCompleted,
    onItemStarted,
    onItemCompleted,
    onReasoningSummaryDelta,
    onReasoningTextDelta,
    onCommandOutputDelta,
    onTerminalInteraction,
    onFileChangeOutputDelta,
    onThreadHistoryChunk,
    onThreadHistoryCompleted,
  };
}
