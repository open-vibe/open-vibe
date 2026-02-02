import { useEffect, useRef } from "react";
import type {
  AppServerEvent,
  ApprovalRequest,
  RequestUserInputRequest,
} from "../../../types";
import { subscribeAppServerEvents } from "../../../services/events";
import { extractTokenUsageCandidate } from "../../threads/utils/threadNormalize";

type AgentDelta = {
  workspaceId: string;
  threadId: string;
  itemId: string;
  delta: string;
};

type AgentCompleted = {
  workspaceId: string;
  threadId: string;
  itemId: string;
  text: string;
};

type AppServerEventHandlers = {
  onWorkspaceConnected?: (workspaceId: string) => void;
  onApprovalRequest?: (request: ApprovalRequest) => void;
  onRequestUserInput?: (request: RequestUserInputRequest) => void;
  onAgentMessageDelta?: (event: AgentDelta) => void;
  onAgentMessageCompleted?: (event: AgentCompleted) => void;
  onAppServerEvent?: (event: AppServerEvent) => void;
  onTurnStarted?: (workspaceId: string, threadId: string, turnId: string) => void;
  onTurnCompleted?: (workspaceId: string, threadId: string, turnId: string) => void;
  onTurnError?: (
    workspaceId: string,
    threadId: string,
    turnId: string,
    payload: { message: string; willRetry: boolean },
  ) => void;
  onTurnPlanUpdated?: (
    workspaceId: string,
    threadId: string,
    turnId: string,
    payload: { explanation: unknown; plan: unknown },
  ) => void;
  onItemStarted?: (workspaceId: string, threadId: string, item: Record<string, unknown>) => void;
  onItemCompleted?: (workspaceId: string, threadId: string, item: Record<string, unknown>) => void;
  onReasoningSummaryDelta?: (workspaceId: string, threadId: string, itemId: string, delta: string) => void;
  onReasoningTextDelta?: (workspaceId: string, threadId: string, itemId: string, delta: string) => void;
  onCommandOutputDelta?: (workspaceId: string, threadId: string, itemId: string, delta: string) => void;
  onTerminalInteraction?: (
    workspaceId: string,
    threadId: string,
    itemId: string,
    stdin: string,
  ) => void;
  onFileChangeOutputDelta?: (workspaceId: string, threadId: string, itemId: string, delta: string) => void;
  onTurnDiffUpdated?: (workspaceId: string, threadId: string, diff: string) => void;
  onThreadTokenUsageUpdated?: (
    workspaceId: string,
    threadId: string,
    tokenUsage: Record<string, unknown>,
  ) => void;
  onAccountRateLimitsUpdated?: (
    workspaceId: string,
    rateLimits: Record<string, unknown>,
  ) => void;
};

function getThreadIdFromParams(params: Record<string, unknown> | null) {
  if (!params) {
    return "";
  }
  const turn = params.turn as Record<string, unknown> | undefined;
  const info = params.info as Record<string, unknown> | undefined;
  const msg = params.msg as Record<string, unknown> | undefined;
  const raw =
    params.threadId ??
    params.thread_id ??
    params.conversationId ??
    params.conversation_id ??
    msg?.threadId ??
    msg?.thread_id ??
    msg?.conversationId ??
    msg?.conversation_id ??
    turn?.threadId ??
    turn?.thread_id ??
    info?.threadId ??
    info?.thread_id;
  return raw ? String(raw) : "";
}

function extractTokenUsageFromParams(params: Record<string, unknown> | null) {
  if (!params) {
    return null;
  }
  const direct = extractTokenUsageCandidate(params);
  if (direct) {
    return direct;
  }
  const msg = params.msg;
  if (msg && typeof msg === "object" && !Array.isArray(msg)) {
    const fromMsg = extractTokenUsageCandidate(msg as Record<string, unknown>);
    if (fromMsg) {
      return fromMsg;
    }
    const msgInfo = (msg as Record<string, unknown>).info;
    if (msgInfo && typeof msgInfo === "object" && !Array.isArray(msgInfo)) {
      const fromInfo = extractTokenUsageCandidate(
        msgInfo as Record<string, unknown>,
      );
      if (fromInfo) {
        return fromInfo;
      }
    }
  }
  const turn = params.turn;
  if (turn && typeof turn === "object" && !Array.isArray(turn)) {
    const fromTurn = extractTokenUsageCandidate(turn as Record<string, unknown>);
    if (fromTurn) {
      return fromTurn;
    }
  }
  const info = params.info;
  if (info && typeof info === "object" && !Array.isArray(info)) {
    const fromInfo = extractTokenUsageCandidate(info as Record<string, unknown>);
    if (fromInfo) {
      return fromInfo;
    }
  }
  const payload = params.payload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const fromPayload = extractTokenUsageCandidate(
      payload as Record<string, unknown>,
    );
    if (fromPayload) {
      return fromPayload;
    }
  }
  return null;
}

function extractAgentMessageText(item: Record<string, unknown>) {
  const rawText = item.text;
  if (typeof rawText === "string" && rawText.trim()) {
    return rawText;
  }
  const content = item.content;
  if (Array.isArray(content)) {
    const text = content
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return "";
        }
        const typed = entry as Record<string, unknown>;
        if (typed.type === "text" && typeof typed.text === "string") {
          return typed.text;
        }
        return "";
      })
      .filter(Boolean)
      .join("");
    if (text.trim()) {
      return text;
    }
  }
  if (content && typeof content === "object") {
    const typed = content as Record<string, unknown>;
    if (typed.type === "text" && typeof typed.text === "string") {
      return typed.text;
    }
    if (typed.type === "output" && typed.data && typeof typed.data === "object") {
      const data = typed.data as Record<string, unknown>;
      const message = data.message as Record<string, unknown> | undefined;
      const messageContent = message?.content;
      if (Array.isArray(messageContent)) {
        const text = messageContent
          .map((entry) => {
            if (!entry || typeof entry !== "object") {
              return "";
            }
            const typedEntry = entry as Record<string, unknown>;
            return typedEntry.type === "text" && typeof typedEntry.text === "string"
              ? typedEntry.text
              : "";
          })
          .filter(Boolean)
          .join("");
        if (text.trim()) {
          return text;
        }
      }
      if (typeof messageContent === "string" && messageContent.trim()) {
        return messageContent;
      }
    }
  }
  return "";
}

export function useAppServerEvents(handlers: AppServerEventHandlers) {
  const completedAgentItemsRef = useRef(new Set<string>());

  useEffect(() => {
    const handleAgentCompletion = (
      workspaceId: string,
      threadId: string,
      item: Record<string, unknown>,
    ) => {
      const itemId = String(
        item.id ?? item.itemId ?? item.item_id ?? "",
      ).trim();
      if (!itemId || completedAgentItemsRef.current.has(itemId)) {
        return;
      }
      const text = extractAgentMessageText(item);
      if (!text.trim()) {
        return;
      }
      completedAgentItemsRef.current.add(itemId);
      handlers.onAgentMessageCompleted?.({
        workspaceId,
        threadId,
        itemId,
        text,
      });
    };

    const unlisten = subscribeAppServerEvents((payload) => {
      handlers.onAppServerEvent?.(payload);

      const { workspace_id, message } = payload;
      const method = String(message.method ?? "");
      const params = (message.params as Record<string, unknown>) ?? null;

      let tokenUsageHandled = false;
      const usageCandidate = extractTokenUsageFromParams(params);
      const usageThreadId = getThreadIdFromParams(params);
      if (usageCandidate) {
        if (usageThreadId) {
          handlers.onThreadTokenUsageUpdated?.(
            workspace_id,
            usageThreadId,
            usageCandidate,
          );
          tokenUsageHandled = true;
        }
      }

      if (method === "codex/connected") {
        handlers.onWorkspaceConnected?.(workspace_id);
        return;
      }

      const requestId = message.id;
      const hasRequestId =
        typeof requestId === "number" || typeof requestId === "string";

      if (method.includes("requestApproval") && hasRequestId) {
        handlers.onApprovalRequest?.({
          workspace_id,
          request_id: requestId,
          method,
          params: (message.params as Record<string, unknown>) ?? {},
        });
        return;
      }

      if (method === "item/tool/requestUserInput" && hasRequestId) {
        const params = (message.params as Record<string, unknown>) ?? {};
        const questionsRaw = Array.isArray(params.questions) ? params.questions : [];
        const questions = questionsRaw
          .map((entry) => {
            const question = entry as Record<string, unknown>;
            const optionsRaw = Array.isArray(question.options) ? question.options : [];
            const options = optionsRaw
              .map((option) => {
                const record = option as Record<string, unknown>;
                const label = String(record.label ?? "").trim();
                const description = String(record.description ?? "").trim();
                if (!label && !description) {
                  return null;
                }
                return { label, description };
              })
              .filter((option): option is { label: string; description: string } => Boolean(option));
            return {
              id: String(question.id ?? "").trim(),
              header: String(question.header ?? ""),
              question: String(question.question ?? ""),
              isOther: Boolean(question.isOther ?? question.is_other),
              options: options.length ? options : undefined,
            };
          })
          .filter((question) => question.id);
        handlers.onRequestUserInput?.({
          workspace_id,
          request_id: requestId,
          params: {
            thread_id: String(params.threadId ?? params.thread_id ?? ""),
            turn_id: String(params.turnId ?? params.turn_id ?? ""),
            item_id: String(params.itemId ?? params.item_id ?? ""),
            questions,
          },
        });
        return;
      }

      if (method === "item/agentMessage/delta") {
        const params = message.params as Record<string, unknown>;
        const threadId = String(params.threadId ?? params.thread_id ?? "");
        const itemId = String(params.itemId ?? params.item_id ?? "");
        const delta = String(params.delta ?? "");
        if (threadId && itemId && delta) {
          handlers.onAgentMessageDelta?.({
            workspaceId: workspace_id,
            threadId,
            itemId,
            delta,
          });
        }
        return;
      }

      if (method === "turn/started") {
        const params = message.params as Record<string, unknown>;
        const turn = params.turn as Record<string, unknown> | undefined;
        const threadId = String(
          params.threadId ?? params.thread_id ?? turn?.threadId ?? turn?.thread_id ?? "",
        );
        const turnId = String(turn?.id ?? params.turnId ?? params.turn_id ?? "");
        if (threadId) {
          handlers.onTurnStarted?.(workspace_id, threadId, turnId);
        }
        return;
      }

      if (method === "error") {
        const params = message.params as Record<string, unknown>;
        const threadId = String(params.threadId ?? params.thread_id ?? "");
        const turnId = String(params.turnId ?? params.turn_id ?? "");
        const error = (params.error as Record<string, unknown> | undefined) ?? {};
        const messageText = String(error.message ?? "");
        const willRetry = Boolean(params.willRetry ?? params.will_retry);
        if (threadId) {
          handlers.onTurnError?.(workspace_id, threadId, turnId, {
            message: messageText,
            willRetry,
          });
        }
        return;
      }

      if (method === "turn/completed") {
        const params = message.params as Record<string, unknown>;
        const turn = params.turn as Record<string, unknown> | undefined;
        const threadId = String(
          params.threadId ?? params.thread_id ?? turn?.threadId ?? turn?.thread_id ?? "",
        );
        const turnId = String(turn?.id ?? params.turnId ?? params.turn_id ?? "");
        if (threadId) {
          handlers.onTurnCompleted?.(workspace_id, threadId, turnId);
          const items = Array.isArray(turn?.items)
            ? (turn?.items as Record<string, unknown>[])
            : [];
          const agentItem = items
            .slice()
            .reverse()
            .find((entry) => entry?.type === "agentMessage");
          if (agentItem) {
            handleAgentCompletion(workspace_id, threadId, agentItem);
          }
        }
        return;
      }

      if (method === "turn/plan/updated") {
        const params = message.params as Record<string, unknown>;
        const threadId = String(params.threadId ?? params.thread_id ?? "");
        const turnId = String(params.turnId ?? params.turn_id ?? "");
        if (threadId) {
          handlers.onTurnPlanUpdated?.(workspace_id, threadId, turnId, {
            explanation: params.explanation,
            plan: params.plan,
          });
        }
        return;
      }

      if (method === "turn/diff/updated") {
        const params = message.params as Record<string, unknown>;
        const threadId = String(params.threadId ?? params.thread_id ?? "");
        const diff = String(params.diff ?? "");
        if (threadId && diff) {
          handlers.onTurnDiffUpdated?.(workspace_id, threadId, diff);
        }
        return;
      }

      if (
        method === "thread/tokenUsage/updated" ||
        method === "thread/token_usage/updated" ||
        method === "thread/token-usage/updated"
      ) {
        if (!tokenUsageHandled) {
          const threadId = String(params?.threadId ?? params?.thread_id ?? "");
          const tokenUsage =
            (params?.tokenUsage as Record<string, unknown> | undefined) ??
            (params?.token_usage as Record<string, unknown> | undefined);
          if (threadId && tokenUsage) {
            handlers.onThreadTokenUsageUpdated?.(workspace_id, threadId, tokenUsage);
          }
        }
        return;
      }

      if (method === "account/rateLimits/updated") {
        const params = message.params as Record<string, unknown>;
        const rateLimits =
          (params.rateLimits as Record<string, unknown> | undefined) ??
          (params.rate_limits as Record<string, unknown> | undefined);
        if (rateLimits) {
          handlers.onAccountRateLimitsUpdated?.(workspace_id, rateLimits);
        }
        return;
      }

      if (method === "item/agentMessage/completed" || method === "item/agentMessage/complete") {
        const params = message.params as Record<string, unknown>;
        const threadId = getThreadIdFromParams(params);
        const item =
          (params.item as Record<string, unknown> | undefined) ?? params;
        if (threadId && item) {
          handleAgentCompletion(workspace_id, threadId, item);
        }
        return;
      }

      if (method === "item/completed") {
        const params = message.params as Record<string, unknown>;
        const threadId = String(params.threadId ?? params.thread_id ?? "");
        const item = params.item as Record<string, unknown> | undefined;
        if (threadId && item) {
          handlers.onItemCompleted?.(workspace_id, threadId, item);
        }
        if (threadId && item?.type === "agentMessage") {
          handleAgentCompletion(workspace_id, threadId, item);
        }
        return;
      }

      if (method === "item/started") {
        const params = message.params as Record<string, unknown>;
        const threadId = String(params.threadId ?? params.thread_id ?? "");
        const item = params.item as Record<string, unknown> | undefined;
        if (threadId && item) {
          handlers.onItemStarted?.(workspace_id, threadId, item);
        }
        return;
      }

      if (method === "item/reasoning/summaryTextDelta") {
        const params = message.params as Record<string, unknown>;
        const threadId = String(params.threadId ?? params.thread_id ?? "");
        const itemId = String(params.itemId ?? params.item_id ?? "");
        const delta = String(params.delta ?? "");
        if (threadId && itemId && delta) {
          handlers.onReasoningSummaryDelta?.(workspace_id, threadId, itemId, delta);
        }
        return;
      }

      if (method === "item/reasoning/textDelta") {
        const params = message.params as Record<string, unknown>;
        const threadId = String(params.threadId ?? params.thread_id ?? "");
        const itemId = String(params.itemId ?? params.item_id ?? "");
        const delta = String(params.delta ?? "");
        if (threadId && itemId && delta) {
          handlers.onReasoningTextDelta?.(workspace_id, threadId, itemId, delta);
        }
        return;
      }

      if (method === "item/commandExecution/outputDelta") {
        const params = message.params as Record<string, unknown>;
        const threadId = String(params.threadId ?? params.thread_id ?? "");
        const itemId = String(params.itemId ?? params.item_id ?? "");
        const delta = String(params.delta ?? "");
        if (threadId && itemId && delta) {
          handlers.onCommandOutputDelta?.(workspace_id, threadId, itemId, delta);
        }
        return;
      }

      if (method === "item/commandExecution/terminalInteraction") {
        const params = message.params as Record<string, unknown>;
        const threadId = String(params.threadId ?? params.thread_id ?? "");
        const itemId = String(params.itemId ?? params.item_id ?? "");
        const stdin = String(params.stdin ?? "");
        if (threadId && itemId) {
          handlers.onTerminalInteraction?.(workspace_id, threadId, itemId, stdin);
        }
        return;
      }

      if (method === "item/fileChange/outputDelta") {
        const params = message.params as Record<string, unknown>;
        const threadId = String(params.threadId ?? params.thread_id ?? "");
        const itemId = String(params.itemId ?? params.item_id ?? "");
        const delta = String(params.delta ?? "");
        if (threadId && itemId && delta) {
          handlers.onFileChangeOutputDelta?.(workspace_id, threadId, itemId, delta);
        }
        return;
      }
    });

    return () => {
      unlisten();
    };
  }, [handlers]);
}
