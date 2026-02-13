import { useCallback } from "react";
import type { Dispatch, MutableRefObject } from "react";
import { interruptTurn as interruptTurnService } from "../../../services/tauri";
import {
  normalizePlanUpdate,
  normalizeRateLimits,
  normalizeTokenUsage,
} from "../utils/threadNormalize";
import type { ThreadAction } from "./useThreadsReducer";

type UseThreadTurnEventsOptions = {
  dispatch: Dispatch<ThreadAction>;
  shouldEnsureThread?: (workspaceId: string, threadId: string) => boolean;
  markProcessing: (threadId: string, isProcessing: boolean) => void;
  markReviewing: (threadId: string, isReviewing: boolean) => void;
  setActiveTurnId: (threadId: string, turnId: string | null) => void;
  pendingInterruptsRef: MutableRefObject<Set<string>>;
  pushThreadErrorMessage: (threadId: string, message: string) => void;
  safeMessageActivity: () => void;
  refreshThreadTokenUsage?: (workspaceId: string, threadId: string) => void;
};

export function useThreadTurnEvents({
  dispatch,
  shouldEnsureThread,
  markProcessing,
  markReviewing,
  setActiveTurnId,
  pendingInterruptsRef,
  pushThreadErrorMessage,
  safeMessageActivity,
  refreshThreadTokenUsage,
}: UseThreadTurnEventsOptions) {
  const onTurnStarted = useCallback(
    (workspaceId: string, threadId: string, turnId: string) => {
      if (shouldEnsureThread && !shouldEnsureThread(workspaceId, threadId)) {
        return;
      }
      dispatch({
        type: "ensureThread",
        workspaceId,
        threadId,
      });
      if (pendingInterruptsRef.current.has(threadId)) {
        pendingInterruptsRef.current.delete(threadId);
        if (turnId) {
          void interruptTurnService(workspaceId, threadId, turnId).catch(() => {});
        }
        return;
      }
      markProcessing(threadId, true);
      if (turnId) {
        setActiveTurnId(threadId, turnId);
      }
    },
    [
      dispatch,
      markProcessing,
      pendingInterruptsRef,
      setActiveTurnId,
      shouldEnsureThread,
    ],
  );

  const onTurnCompleted = useCallback(
    (workspaceId: string, threadId: string, _turnId: string) => {
      markProcessing(threadId, false);
      setActiveTurnId(threadId, null);
      pendingInterruptsRef.current.delete(threadId);
      if (refreshThreadTokenUsage) {
        setTimeout(() => {
          refreshThreadTokenUsage(workspaceId, threadId);
        }, 250);
      }
    },
    [markProcessing, pendingInterruptsRef, refreshThreadTokenUsage, setActiveTurnId],
  );

  const onTurnPlanUpdated = useCallback(
    (
      workspaceId: string,
      threadId: string,
      turnId: string,
      payload: { explanation: unknown; plan: unknown },
    ) => {
      if (shouldEnsureThread && !shouldEnsureThread(workspaceId, threadId)) {
        return;
      }
      dispatch({ type: "ensureThread", workspaceId, threadId });
      const normalized = normalizePlanUpdate(
        turnId,
        payload.explanation,
        payload.plan,
      );
      dispatch({ type: "setThreadPlan", threadId, plan: normalized });
    },
    [dispatch, shouldEnsureThread],
  );

  const onThreadTokenUsageUpdated = useCallback(
    (workspaceId: string, threadId: string, tokenUsage: Record<string, unknown>) => {
      if (shouldEnsureThread && !shouldEnsureThread(workspaceId, threadId)) {
        return;
      }
      dispatch({ type: "ensureThread", workspaceId, threadId });
      dispatch({
        type: "setThreadTokenUsage",
        threadId,
        tokenUsage: normalizeTokenUsage(tokenUsage),
      });
    },
    [dispatch, shouldEnsureThread],
  );

  const onAccountRateLimitsUpdated = useCallback(
    (workspaceId: string, rateLimits: Record<string, unknown>) => {
      dispatch({
        type: "setRateLimits",
        workspaceId,
        rateLimits: normalizeRateLimits(rateLimits),
      });
    },
    [dispatch],
  );

  const onTurnError = useCallback(
    (
      workspaceId: string,
      threadId: string,
      _turnId: string,
      payload: { message: string; willRetry: boolean },
    ) => {
      if (payload.willRetry) {
        return;
      }
      if (shouldEnsureThread && !shouldEnsureThread(workspaceId, threadId)) {
        return;
      }
      dispatch({ type: "ensureThread", workspaceId, threadId });
      markProcessing(threadId, false);
      markReviewing(threadId, false);
      setActiveTurnId(threadId, null);
      const message = payload.message
        ? `Turn failed: ${payload.message}`
        : "Turn failed.";
      pushThreadErrorMessage(threadId, message);
      safeMessageActivity();
    },
    [
      dispatch,
      markProcessing,
      markReviewing,
      pushThreadErrorMessage,
      safeMessageActivity,
      setActiveTurnId,
      shouldEnsureThread,
    ],
  );

  return {
    onTurnStarted,
    onTurnCompleted,
    onTurnPlanUpdated,
    onThreadTokenUsageUpdated,
    onAccountRateLimitsUpdated,
    onTurnError,
  };
}
