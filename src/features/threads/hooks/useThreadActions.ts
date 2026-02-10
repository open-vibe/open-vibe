import { useCallback, useRef } from "react";
import type { Dispatch, MutableRefObject } from "react";
import type {
  ConversationItem,
  DebugEntry,
  ThreadSummary,
  WorkspaceInfo,
} from "../../../types";
import {
  archiveThread as archiveThreadService,
  listThreads as listThreadsService,
  listThreadsGlobal as listThreadsGlobalService,
  resumeThread as resumeThreadService,
  startThreadHistoryStream as startThreadHistoryStreamService,
  stopThreadHistoryStream as stopThreadHistoryStreamService,
  startThread as startThreadService,
} from "../../../services/tauri";
import {
  buildItemsFromThread,
  buildConversationItemFromThreadItem,
  getThreadTimestamp,
  isReviewingFromThread,
  mergeThreadItems,
  previewThreadName,
} from "../../../utils/threadItems";
import {
  asString,
  extractTokenUsageCandidate,
  normalizeTokenUsage,
  normalizeRootPath,
} from "../utils/threadNormalize";
import {
  loadThreadSummariesForWorkspace,
  saveThreadActivity,
  saveThreadSummariesForWorkspace,
} from "../utils/threadStorage";
import type { ThreadAction, ThreadState } from "./useThreadsReducer";

type UseThreadActionsOptions = {
  dispatch: Dispatch<ThreadAction>;
  itemsByThread: ThreadState["itemsByThread"];
  threadsByWorkspace: ThreadState["threadsByWorkspace"];
  activeThreadIdByWorkspace: ThreadState["activeThreadIdByWorkspace"];
  threadListCursorByWorkspace: ThreadState["threadListCursorByWorkspace"];
  threadStatusById: ThreadState["threadStatusById"];
  onDebug?: (entry: DebugEntry) => void;
  getCustomName: (workspaceId: string, threadId: string) => string | undefined;
  threadActivityRef: MutableRefObject<Record<string, Record<string, number>>>;
  loadedThreadsRef: MutableRefObject<Record<string, boolean>>;
  replaceOnResumeRef: MutableRefObject<Record<string, boolean>>;
  applyCollabThreadLinksFromThread: (
    threadId: string,
    thread: Record<string, unknown>,
  ) => void;
  refreshThreadTokenUsage?: (workspaceId: string, threadId: string) => void;
  resumeStreamingEnabled?: boolean;
};

function extractTokenUsageFromTurns(
  turns: unknown,
): { usage: Record<string, unknown>; source: string } | null {
  if (!Array.isArray(turns)) {
    return null;
  }
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (!turn || typeof turn !== "object" || Array.isArray(turn)) {
      continue;
    }
    const turnRecord = turn as Record<string, unknown>;
    const usage = extractTokenUsageCandidate(turnRecord);
    if (usage) {
      return { usage, source: "turn" };
    }
    const info = turnRecord.info;
    if (info && typeof info === "object" && !Array.isArray(info)) {
      const nested = extractTokenUsageCandidate(info as Record<string, unknown>);
      if (nested) {
        return { usage: nested, source: "turn.info" };
      }
    }
  }
  return null;
}

type ThreadListResponse = {
  data: Record<string, unknown>[];
  nextCursor: string | null;
};

function getNowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function parseThreadListResponse(response: unknown): ThreadListResponse {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return { data: [], nextCursor: null };
  }
  const record = response as Record<string, unknown>;
  const result =
    record.result && typeof record.result === "object" && !Array.isArray(record.result)
      ? (record.result as Record<string, unknown>)
      : record;
  const data = Array.isArray(result.data)
    ? (result.data as Record<string, unknown>[])
    : [];
  const rawCursor = result.nextCursor ?? result.next_cursor ?? null;
  const nextCursor = typeof rawCursor === "string" ? rawCursor : null;
  return { data, nextCursor };
}

function yieldToMainThread() {
  return new Promise<void>((resolve) => {
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

async function streamThreadItems({
  thread,
  threadId,
  localItems,
  shouldReplace,
  dispatch,
  onFirstChunk,
  onChunk,
}: {
  thread: Record<string, unknown>;
  threadId: string;
  localItems: ConversationItem[];
  shouldReplace: boolean;
  dispatch: Dispatch<ThreadAction>;
  onFirstChunk?: () => void;
  onChunk?: (itemsCount: number) => void;
}) {
  const turns = Array.isArray(thread.turns) ? thread.turns : [];
  const remoteItems: ConversationItem[] = [];
  const batchSize = 120;
  let lastFlushCount = 0;
  let firstChunkSent = false;
  const shouldMerge = localItems.length > 0 && !shouldReplace;

  const flush = () => {
    if (remoteItems.length === lastFlushCount) {
      return;
    }
    let nextItems = remoteItems;
    if (shouldMerge) {
      nextItems = mergeThreadItems(remoteItems, localItems);
    }
    if (nextItems.length > 0 || localItems.length > 0) {
      dispatch({ type: "setThreadItems", threadId, items: nextItems });
    }
    lastFlushCount = remoteItems.length;
    if (!firstChunkSent) {
      firstChunkSent = true;
      onFirstChunk?.();
    }
    onChunk?.(remoteItems.length);
  };

  for (const turn of turns) {
    if (!turn || typeof turn !== "object" || Array.isArray(turn)) {
      continue;
    }
    const turnRecord = turn as Record<string, unknown>;
    const turnItems = Array.isArray(turnRecord.items)
      ? (turnRecord.items as Record<string, unknown>[])
      : [];
    for (const item of turnItems) {
      const converted = buildConversationItemFromThreadItem(item);
      if (converted) {
        remoteItems.push(converted);
      }
      if (remoteItems.length - lastFlushCount >= batchSize) {
        flush();
        await yieldToMainThread();
      }
    }
  }

  flush();
  const finalItems =
    remoteItems.length > 0
      ? shouldReplace
        ? remoteItems
        : shouldMerge
          ? mergeThreadItems(remoteItems, localItems)
          : remoteItems
      : localItems;
  return { items: finalItems };
}

export function useThreadActions({
  dispatch,
  itemsByThread,
  threadsByWorkspace,
  activeThreadIdByWorkspace,
  threadListCursorByWorkspace,
  threadStatusById,
  onDebug,
  getCustomName,
  threadActivityRef,
  loadedThreadsRef,
  replaceOnResumeRef,
  applyCollabThreadLinksFromThread,
  refreshThreadTokenUsage,
  resumeStreamingEnabled = false,
}: UseThreadActionsOptions) {
  const globalListInFlightRef = useRef<Promise<ThreadListResponse> | null>(null);
  const threadPathByIdRef = useRef<Record<string, string>>({});
  const startThreadForWorkspace = useCallback(
    async (workspaceId: string, options?: { activate?: boolean }) => {
      const shouldActivate = options?.activate !== false;
      onDebug?.({
        id: `${Date.now()}-client-thread-start`,
        timestamp: Date.now(),
        source: "client",
        label: "thread/start",
        payload: { workspaceId },
      });
      try {
        const response = await startThreadService(workspaceId);
        onDebug?.({
          id: `${Date.now()}-server-thread-start`,
          timestamp: Date.now(),
          source: "server",
          label: "thread/start response",
          payload: response,
        });
        const thread = response.result?.thread ?? response.thread;
        const threadId = String(thread?.id ?? "");
        if (threadId) {
          dispatch({ type: "ensureThread", workspaceId, threadId });
          if (shouldActivate) {
            dispatch({ type: "setActiveThreadId", workspaceId, threadId });
          }
          loadedThreadsRef.current[threadId] = true;
          return threadId;
        }
        return null;
      } catch (error) {
        onDebug?.({
          id: `${Date.now()}-client-thread-start-error`,
          timestamp: Date.now(),
          source: "error",
          label: "thread/start error",
          payload: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [dispatch, loadedThreadsRef, onDebug],
  );

  const resumeThreadForWorkspace = useCallback(
    async (
      workspaceId: string,
      threadId: string,
      force = false,
      replaceLocal = false,
    ) => {
      if (!threadId) {
        return null;
      }
      if (!force && loadedThreadsRef.current[threadId]) {
        return threadId;
      }
      const localItems = itemsByThread[threadId] ?? [];
      if (!force && localItems.length > 0) {
        loadedThreadsRef.current[threadId] = true;
        return threadId;
      }
      const status = threadStatusById[threadId];
      if (status?.isProcessing && loadedThreadsRef.current[threadId] && !force) {
        onDebug?.({
          id: `${Date.now()}-client-thread-resume-skipped`,
          timestamp: Date.now(),
          source: "client",
          label: "thread/resume skipped",
          payload: { workspaceId, threadId, reason: "active-turn" },
        });
        return threadId;
      }
      onDebug?.({
        id: `${Date.now()}-client-thread-resume`,
        timestamp: Date.now(),
        source: "client",
        label: "thread/resume",
        payload: { workspaceId, threadId },
      });
      const resumeStarted = getNowMs();
      dispatch({ type: "setThreadLoading", threadId, isLoading: true });
      let historyStreamId: string | null = null;
      let shouldForceReplace = replaceLocal;
      if (resumeStreamingEnabled) {
        const historyPath = threadPathByIdRef.current[threadId];
        if (historyPath) {
          try {
            historyStreamId = await startThreadHistoryStreamService(
              workspaceId,
              threadId,
              historyPath,
            );
            shouldForceReplace = true;
            onDebug?.({
              id: `${Date.now()}-client-thread-history-stream-start`,
              timestamp: Date.now(),
              source: "client",
              label: "thread/history stream start",
              payload: { workspaceId, threadId, streamId: historyStreamId },
            });
            if (typeof console !== "undefined") {
              console.info("[thread/history stream start]", {
                workspaceId,
                threadId,
                streamId: historyStreamId,
              });
            }
          } catch (error) {
            onDebug?.({
              id: `${Date.now()}-client-thread-history-stream-error`,
              timestamp: Date.now(),
              source: "error",
              label: "thread/history stream error",
              payload: error instanceof Error ? error.message : String(error),
            });
          }
        } else {
          onDebug?.({
            id: `${Date.now()}-client-thread-history-stream-missing`,
            timestamp: Date.now(),
            source: "client",
            label: "thread/history stream missing path",
            payload: { workspaceId, threadId },
          });
        }
      }
      try {
        const response =
          (await resumeThreadService(workspaceId, threadId)) as
            | Record<string, unknown>
            | null;
        const resumeDurationMs = Math.round(getNowMs() - resumeStarted);
        onDebug?.({
          id: `${Date.now()}-server-thread-resume`,
          timestamp: Date.now(),
          source: "server",
          label: "thread/resume response",
          payload: { response, durationMs: resumeDurationMs },
        });
        if (typeof console !== "undefined") {
          console.info("[thread/resume]", {
            workspaceId,
            threadId,
            durationMs: resumeDurationMs,
          });
        }
        const result = (response?.result ?? response) as
          | Record<string, unknown>
          | null;
        const thread = (result?.thread ?? response?.thread ?? null) as
          | Record<string, unknown>
          | null;
        if (thread) {
          dispatch({ type: "ensureThread", workspaceId, threadId });
          let tokenUsageRaw = extractTokenUsageCandidate(thread);
          if (!tokenUsageRaw) {
            const turnUsage = extractTokenUsageFromTurns(thread.turns);
            if (turnUsage) {
              tokenUsageRaw = turnUsage.usage;
            }
          }
          if (tokenUsageRaw && typeof tokenUsageRaw === "object") {
            dispatch({
              type: "setThreadTokenUsage",
              threadId,
              tokenUsage: normalizeTokenUsage(
                tokenUsageRaw as Record<string, unknown>,
              ),
            });
          } else {
            if (refreshThreadTokenUsage) {
              void refreshThreadTokenUsage(workspaceId, threadId);
            }
          }
          applyCollabThreadLinksFromThread(threadId, thread);
          const localItems = itemsByThread[threadId] ?? [];
          const shouldReplace =
            shouldForceReplace || replaceOnResumeRef.current[threadId] === true;
          if (shouldReplace) {
            replaceOnResumeRef.current[threadId] = false;
          }
          if (localItems.length > 0 && !shouldReplace) {
            loadedThreadsRef.current[threadId] = true;
            return threadId;
          }
          let mergedItems: ConversationItem[] = localItems;
          if (resumeStreamingEnabled && !historyStreamId) {
            const streamStarted = getNowMs();
            const streamed = await streamThreadItems({
              thread,
              threadId,
              localItems,
              shouldReplace,
              dispatch,
              onFirstChunk: () => {
                dispatch({
                  type: "setThreadLoading",
                  threadId,
                  isLoading: false,
                });
              },
            });
            mergedItems = streamed.items;
            const streamDurationMs = Math.round(getNowMs() - streamStarted);
            onDebug?.({
              id: `${Date.now()}-client-thread-resume-stream`,
              timestamp: Date.now(),
              source: "client",
              label: "thread/resume stream",
              payload: {
                workspaceId,
                threadId,
                items: mergedItems.length,
                durationMs: streamDurationMs,
              },
            });
            if (typeof console !== "undefined") {
              console.info("[thread/resume stream]", {
                workspaceId,
                threadId,
                items: mergedItems.length,
                durationMs: streamDurationMs,
              });
            }
          } else {
            const items = buildItemsFromThread(thread);
            const hasOverlap =
              items.length > 0 &&
              localItems.length > 0 &&
              items.some((item) =>
                localItems.some((local) => local.id === item.id),
              );
            mergedItems =
              items.length > 0
                ? shouldReplace
                  ? items
                  : localItems.length > 0 && !hasOverlap
                    ? localItems
                    : mergeThreadItems(items, localItems)
                : localItems;
            if (mergedItems.length > 0) {
              dispatch({ type: "setThreadItems", threadId, items: mergedItems });
            }
          }
          dispatch({
            type: "markReviewing",
            threadId,
            isReviewing: isReviewingFromThread(thread),
          });
          const preview = asString(thread?.preview ?? "");
          const customName = getCustomName(workspaceId, threadId);
          if (!customName && preview) {
            dispatch({
              type: "setThreadName",
              workspaceId,
              threadId,
              name: previewThreadName(preview, `Agent ${threadId.slice(0, 4)}`),
            });
          }
          const lastAgentMessage = [...mergedItems]
            .reverse()
            .find(
              (item) => item.kind === "message" && item.role === "assistant",
            ) as ConversationItem | undefined;
          const lastText =
            lastAgentMessage && lastAgentMessage.kind === "message"
              ? lastAgentMessage.text
              : preview;
          if (lastText) {
            dispatch({
              type: "setLastAgentMessage",
              threadId,
              text: lastText,
              timestamp: getThreadTimestamp(thread),
            });
          }
        }
        loadedThreadsRef.current[threadId] = true;
        return threadId;
      } catch (error) {
        onDebug?.({
          id: `${Date.now()}-client-thread-resume-error`,
          timestamp: Date.now(),
          source: "error",
          label: "thread/resume error",
          payload: error instanceof Error ? error.message : String(error),
        });
        return null;
      } finally {
        if (historyStreamId) {
          try {
            await stopThreadHistoryStreamService(threadId, historyStreamId);
          } catch (error) {
            onDebug?.({
              id: `${Date.now()}-client-thread-history-stream-stop-error`,
              timestamp: Date.now(),
              source: "error",
              label: "thread/history stream stop error",
              payload: error instanceof Error ? error.message : String(error),
            });
          }
        }
        dispatch({ type: "setThreadLoading", threadId, isLoading: false });
      }
    },
    [
      applyCollabThreadLinksFromThread,
      dispatch,
      getCustomName,
      itemsByThread,
      loadedThreadsRef,
      onDebug,
      replaceOnResumeRef,
      resumeStreamingEnabled,
      refreshThreadTokenUsage,
      threadStatusById,
    ],
  );

  const refreshThread = useCallback(
    async (workspaceId: string, threadId: string) => {
      if (!threadId) {
        return null;
      }
      replaceOnResumeRef.current[threadId] = true;
      return resumeThreadForWorkspace(workspaceId, threadId, true, true);
    },
    [replaceOnResumeRef, resumeThreadForWorkspace],
  );

  const fetchGlobalThreadList = useCallback(async () => {
    if (globalListInFlightRef.current) {
      return globalListInFlightRef.current;
    }
    const promise = (async () => {
      const startedAt = getNowMs();
      try {
        const response = await listThreadsGlobalService();
        const parsed = parseThreadListResponse(response);
        parsed.data.forEach((thread) => {
          const id = String(thread?.id ?? "");
          const path = asString(thread?.path ?? "").trim();
          if (id && path) {
            threadPathByIdRef.current[id] = path;
          }
        });
        const durationMs = Math.round(getNowMs() - startedAt);
        onDebug?.({
          id: `${Date.now()}-client-thread-list-global`,
          timestamp: Date.now(),
          source: "client",
          label: "thread/list global",
          payload: {
            totalFetched: parsed.data.length,
            durationMs,
          },
        });
        if (typeof console !== "undefined") {
          console.info("[thread/list global]", {
            totalFetched: parsed.data.length,
            durationMs,
          });
        }
        return parsed;
      } catch (error) {
        onDebug?.({
          id: `${Date.now()}-client-thread-list-global-error`,
          timestamp: Date.now(),
          source: "error",
          label: "thread/list global error",
          payload: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    })();
    globalListInFlightRef.current = promise;
    try {
      return await promise;
    } finally {
      globalListInFlightRef.current = null;
    }
  }, [onDebug]);

  const resetWorkspaceThreads = useCallback(
    (workspaceId: string) => {
      const threadIds = new Set<string>();
      const list = threadsByWorkspace[workspaceId] ?? [];
      list.forEach((thread) => threadIds.add(thread.id));
      const activeThread = activeThreadIdByWorkspace[workspaceId];
      if (activeThread) {
        threadIds.add(activeThread);
      }
      threadIds.forEach((threadId) => {
        loadedThreadsRef.current[threadId] = false;
      });
    },
    [activeThreadIdByWorkspace, loadedThreadsRef, threadsByWorkspace],
  );

  const listThreadsForWorkspace = useCallback(
    async (workspace: WorkspaceInfo) => {
      const workspacePath = normalizeRootPath(workspace.path);
      const cachedThreads = loadThreadSummariesForWorkspace(workspace.id);
      const existingThreads = threadsByWorkspace[workspace.id] ?? [];
      if (existingThreads.length === 0 && cachedThreads.length > 0) {
        dispatch({
          type: "setThreads",
          workspaceId: workspace.id,
          threads: cachedThreads,
        });
      }
      dispatch({
        type: "setThreadListLoading",
        workspaceId: workspace.id,
        isLoading: true,
      });
      dispatch({
        type: "setThreadListCursor",
        workspaceId: workspace.id,
        cursor: null,
      });
      onDebug?.({
        id: `${Date.now()}-client-thread-list`,
        timestamp: Date.now(),
        source: "client",
        label: "thread/list",
        payload: { workspaceId: workspace.id, path: workspace.path },
      });
      try {
        const fetchStarted = getNowMs();
        const { data } = await fetchGlobalThreadList();
        const fetchDurationMs = Math.round(getNowMs() - fetchStarted);
        const sampleCwds = Array.from(
          new Set(
            data
              .map((thread) => String(thread?.cwd ?? ""))
              .filter((cwd) => cwd.length > 0),
          ),
        ).slice(0, 5);
        const matchingThreads = data.filter(
          (thread) =>
            normalizeRootPath(String(thread?.cwd ?? "")) === workspacePath,
        );
        onDebug?.({
          id: `${Date.now()}-client-thread-list-summary`,
          timestamp: Date.now(),
          source: "client",
          label: "thread/list summary",
          payload: {
            workspaceId: workspace.id,
            workspacePath,
            totalFetched: data.length,
            matched: matchingThreads.length,
            sampleCwds,
            fetchDurationMs,
          },
        });
        if (typeof console !== "undefined") {
          console.info("[thread/list]", {
            workspaceId: workspace.id,
            workspacePath,
            totalFetched: data.length,
            matched: matchingThreads.length,
            sampleCwds,
            fetchDurationMs,
          });
        }

        const applyStarted = getNowMs();
        const uniqueById = new Map<string, Record<string, unknown>>();
        matchingThreads.forEach((thread) => {
          const id = String(thread?.id ?? "");
          if (id && !uniqueById.has(id)) {
            uniqueById.set(id, thread);
          }
        });
        const uniqueThreads = Array.from(uniqueById.values());
        const activityByThread = threadActivityRef.current[workspace.id] ?? {};
        const nextActivityByThread = { ...activityByThread };
        let didChangeActivity = false;
        uniqueThreads.forEach((thread) => {
          const threadId = String(thread?.id ?? "");
          if (!threadId) {
            return;
          }
          const path = asString(thread?.path ?? "").trim();
          if (path) {
            threadPathByIdRef.current[threadId] = path;
          }
          const timestamp = getThreadTimestamp(thread);
          if (timestamp > (nextActivityByThread[threadId] ?? 0)) {
            nextActivityByThread[threadId] = timestamp;
            didChangeActivity = true;
          }
        });
        if (didChangeActivity) {
          const next = {
            ...threadActivityRef.current,
            [workspace.id]: nextActivityByThread,
          };
          threadActivityRef.current = next;
          saveThreadActivity(next);
        }
        uniqueThreads.sort((a, b) => {
          const aId = String(a?.id ?? "");
          const bId = String(b?.id ?? "");
          const aCreated = getThreadTimestamp(a);
          const bCreated = getThreadTimestamp(b);
          const aActivity = Math.max(nextActivityByThread[aId] ?? 0, aCreated);
          const bActivity = Math.max(nextActivityByThread[bId] ?? 0, bCreated);
          return bActivity - aActivity;
        });
        const summaries = uniqueThreads
          .map((thread, index) => {
            const id = String(thread?.id ?? "");
            const preview = asString(thread?.preview ?? "").trim();
            const customName = getCustomName(workspace.id, id);
            const fallbackName = `Agent ${index + 1}`;
            const name = customName
              ? customName
              : preview.length > 0
                ? preview.length > 38
                  ? `${preview.slice(0, 38)}…`
                  : preview
                : fallbackName;
            return {
              id,
              name,
              updatedAt: getThreadTimestamp(thread),
            };
          })
          .filter((entry) => entry.id);
        const shouldUpdateThreads =
          summaries.length > 0 || (!cachedThreads.length && !existingThreads.length);
        if (shouldUpdateThreads) {
          dispatch({
            type: "setThreads",
            workspaceId: workspace.id,
            threads: summaries,
          });
          if (summaries.length > 0) {
            saveThreadSummariesForWorkspace(workspace.id, summaries);
          }
        }
        dispatch({
          type: "setThreadListCursor",
          workspaceId: workspace.id,
          cursor: null,
        });
        const applyDurationMs = Math.round(getNowMs() - applyStarted);
        if (typeof console !== "undefined") {
          console.info("[thread/list apply]", {
            workspaceId: workspace.id,
            matched: matchingThreads.length,
            durationMs: applyDurationMs,
          });
        }
        if (shouldUpdateThreads) {
          uniqueThreads.forEach((thread) => {
            const threadId = String(thread?.id ?? "");
            const preview = asString(thread?.preview ?? "").trim();
            if (!threadId || !preview) {
              return;
            }
            dispatch({
              type: "setLastAgentMessage",
              threadId,
              text: preview,
              timestamp: getThreadTimestamp(thread),
            });
          });
        }
      } catch (error) {
        onDebug?.({
          id: `${Date.now()}-client-thread-list-error`,
          timestamp: Date.now(),
          source: "error",
          label: "thread/list error",
          payload: error instanceof Error ? error.message : String(error),
        });
      } finally {
        dispatch({
          type: "setThreadListLoading",
          workspaceId: workspace.id,
          isLoading: false,
        });
      }
    },
    [
      dispatch,
      fetchGlobalThreadList,
      getCustomName,
      onDebug,
      threadActivityRef,
      threadsByWorkspace,
    ],
  );

  const loadOlderThreadsForWorkspace = useCallback(
    async (workspace: WorkspaceInfo) => {
      const nextCursor = threadListCursorByWorkspace[workspace.id] ?? null;
      if (!nextCursor) {
        return;
      }
      const workspacePath = normalizeRootPath(workspace.path);
      const existing = threadsByWorkspace[workspace.id] ?? [];
      dispatch({
        type: "setThreadListPaging",
        workspaceId: workspace.id,
        isLoading: true,
      });
      onDebug?.({
        id: `${Date.now()}-client-thread-list-older`,
        timestamp: Date.now(),
        source: "client",
        label: "thread/list older",
        payload: { workspaceId: workspace.id, cursor: nextCursor },
      });
      try {
        const matchingThreads: Record<string, unknown>[] = [];
        const targetCount = 20;
        const pageSize = 20;
        const maxPagesWithoutMatch = 10;
        let pagesFetched = 0;
        let cursor: string | null = nextCursor;
        do {
          pagesFetched += 1;
          const response =
            (await listThreadsService(
              workspace.id,
              cursor,
              pageSize,
            )) as Record<string, unknown>;
          onDebug?.({
            id: `${Date.now()}-server-thread-list-older`,
            timestamp: Date.now(),
            source: "server",
            label: "thread/list older response",
            payload: response,
          });
          const result = (response.result ?? response) as Record<string, unknown>;
          const data = Array.isArray(result?.data)
            ? (result.data as Record<string, unknown>[])
            : [];
          data.forEach((thread) => {
            const id = String(thread?.id ?? "");
            const path = asString(thread?.path ?? "").trim();
            if (id && path) {
              threadPathByIdRef.current[id] = path;
            }
          });
          const next =
            (result?.nextCursor ?? result?.next_cursor ?? null) as string | null;
          matchingThreads.push(
            ...data.filter(
              (thread) =>
                normalizeRootPath(String(thread?.cwd ?? "")) === workspacePath,
            ),
          );
          cursor = next;
          if (matchingThreads.length === 0 && pagesFetched >= maxPagesWithoutMatch) {
            break;
          }
        } while (cursor && matchingThreads.length < targetCount);

        const existingIds = new Set(existing.map((thread) => thread.id));
        const additions: ThreadSummary[] = [];
        matchingThreads.forEach((thread) => {
          const id = String(thread?.id ?? "");
          if (!id || existingIds.has(id)) {
            return;
          }
          const preview = asString(thread?.preview ?? "").trim();
          const customName = getCustomName(workspace.id, id);
          const fallbackName = `Agent ${existing.length + additions.length + 1}`;
          const name = customName
            ? customName
            : preview.length > 0
              ? preview.length > 38
                ? `${preview.slice(0, 38)}…`
                : preview
              : fallbackName;
          additions.push({ id, name, updatedAt: getThreadTimestamp(thread) });
          existingIds.add(id);
        });

        if (additions.length > 0) {
          const nextThreads = [...existing, ...additions];
          dispatch({
            type: "setThreads",
            workspaceId: workspace.id,
            threads: nextThreads,
          });
          saveThreadSummariesForWorkspace(workspace.id, nextThreads);
        }
        dispatch({
          type: "setThreadListCursor",
          workspaceId: workspace.id,
          cursor,
        });
        matchingThreads.forEach((thread) => {
          const threadId = String(thread?.id ?? "");
          const preview = asString(thread?.preview ?? "").trim();
          if (!threadId || !preview) {
            return;
          }
          dispatch({
            type: "setLastAgentMessage",
            threadId,
            text: preview,
            timestamp: getThreadTimestamp(thread),
          });
        });
      } catch (error) {
        onDebug?.({
          id: `${Date.now()}-client-thread-list-older-error`,
          timestamp: Date.now(),
          source: "error",
          label: "thread/list older error",
          payload: error instanceof Error ? error.message : String(error),
        });
      } finally {
        dispatch({
          type: "setThreadListPaging",
          workspaceId: workspace.id,
          isLoading: false,
        });
      }
    },
    [dispatch, getCustomName, onDebug, threadListCursorByWorkspace, threadsByWorkspace],
  );

  const archiveThread = useCallback(
    async (workspaceId: string, threadId: string) => {
      try {
        await archiveThreadService(workspaceId, threadId);
        return true;
      } catch (error) {
        onDebug?.({
          id: `${Date.now()}-client-thread-archive-error`,
          timestamp: Date.now(),
          source: "error",
          label: "thread/archive error",
          payload: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    },
    [onDebug],
  );

  return {
    startThreadForWorkspace,
    resumeThreadForWorkspace,
    refreshThread,
    resetWorkspaceThreads,
    listThreadsForWorkspace,
    loadOlderThreadsForWorkspace,
    archiveThread,
  };
}
