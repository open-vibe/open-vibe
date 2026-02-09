import { useCallback, useRef } from "react";
import type { NanobotBridgeEvent, WorkspaceInfo } from "../../../types";
import { sendNanobotBridgeCommand } from "../../../services/tauri";
import { subscribeNanobotBridgeEvents } from "../../../services/events";
import { useTauriEvent } from "../../app/hooks/useTauriEvent";
import type { ThreadTab } from "../../app/hooks/useThreadTabs";

type UseNanobotBridgeEventsOptions = {
  enabled: boolean;
  workspaces: WorkspaceInfo[];
  activeWorkspaceId: string | null;
  openThreadTabs: ThreadTab[];
  startThreadForWorkspace: (workspaceId: string) => Promise<string | null>;
  sendUserMessageToThread: (
    workspace: WorkspaceInfo,
    threadId: string,
    text: string,
    images?: string[],
    options?: { skipPromptExpansion?: boolean; skipHappyBridgeEcho?: boolean },
  ) => Promise<void>;
};

type SessionRoute = {
  sessionKey: string;
  channel: string;
  chatId: string;
  workspaceId: string;
  threadId: string;
};

type SessionMode = "bridge" | "agent";

type RelayCandidate = {
  workspaceId: string;
  threadId: string;
  title: string;
};

const AGENT_MODE_REPLY =
  "Agent mode is selected, but agent execution is not wired yet. Send /mode bridge to resume relay mode.";

function isMenuCommand(raw: string) {
  const lower = raw.toLowerCase();
  return lower === "/menu" || lower === "/help" || raw === "菜单" || raw === "帮助";
}

function parseModeCommand(raw: string): SessionMode | null {
  const lower = raw.toLowerCase();
  if (lower === "/mode bridge" || raw === "桥接模式") {
    return "bridge";
  }
  if (lower === "/mode agent" || raw === "agent模式") {
    return "agent";
  }
  return null;
}

function parseRelayCommand(raw: string): number | null | undefined {
  const lower = raw.toLowerCase();
  if (lower === "/relay" || raw === "接力") {
    return null;
  }
  const relayMatch = lower.match(/^\/relay\s+(\d+)$/);
  if (relayMatch) {
    return Number(relayMatch[1]);
  }
  const zhMatch = raw.match(/^接力\s*(\d+)$/);
  if (zhMatch) {
    return Number(zhMatch[1]);
  }
  return undefined;
}

function buildMenuText(currentMode: SessionMode) {
  const modeLabel = currentMode === "agent" ? "agent" : "bridge";
  return [
    "OpenVibe Nanobot menu",
    `Current mode: ${modeLabel}`,
    "",
    "- Relay mode: /mode bridge",
    "- Agent mode: /mode agent",
    "- List relay sessions: /relay",
    "- Pick relay session: /relay <number>",
  ].join("\n");
}

export function useNanobotBridgeEvents({
  enabled,
  workspaces,
  activeWorkspaceId,
  openThreadTabs,
  startThreadForWorkspace,
  sendUserMessageToThread,
}: UseNanobotBridgeEventsOptions) {
  const routesRef = useRef<Map<string, SessionRoute>>(new Map());
  const creatingRouteRef = useRef<Map<string, Promise<SessionRoute | null>>>(
    new Map(),
  );
  const sessionModeRef = useRef<Map<string, SessionMode>>(new Map());
  const relayOptionsRef = useRef<Map<string, RelayCandidate[]>>(new Map());

  const resolveDefaultWorkspace = useCallback(() => {
    if (!workspaces.length) {
      return null;
    }
    if (activeWorkspaceId) {
      const active = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
      if (active) {
        return active;
      }
    }
    return workspaces[0] ?? null;
  }, [activeWorkspaceId, workspaces]);

  const sendBridgeReply = useCallback(
    async (
      event: Extract<NanobotBridgeEvent, { type: "remote-message" }>,
      content: string,
    ) => {
      await sendNanobotBridgeCommand({
        type: "direct-message",
        channel: event.channel,
        chatId: event.chatId,
        content,
      });
    },
    [],
  );

  const getRelayCandidates = useCallback(() => {
    const workspaceNameById = new Map(
      workspaces.map((workspace) => [workspace.id, workspace.name] as const),
    );
    return openThreadTabs
      .filter((tab): tab is ThreadTab & { kind: "thread"; threadId: string } => tab.kind === "thread")
      .map((tab) => {
        const workspaceName = workspaceNameById.get(tab.workspaceId) ?? tab.workspaceId;
        return {
          workspaceId: tab.workspaceId,
          threadId: tab.threadId,
          title: `${workspaceName} / ${tab.title}`,
        };
      });
  }, [openThreadTabs, workspaces]);

  const ensureRoute = useCallback(
    async (
      event: Extract<NanobotBridgeEvent, { type: "remote-message" }>,
    ): Promise<SessionRoute | null> => {
      const mappedWorkspaceId = event.workspaceId?.trim();
      const mappedThreadId = event.threadId?.trim();
      if (mappedWorkspaceId && mappedThreadId) {
        const mapped: SessionRoute = {
          sessionKey: event.sessionKey,
          channel: event.channel,
          chatId: event.chatId,
          workspaceId: mappedWorkspaceId,
          threadId: mappedThreadId,
        };
        routesRef.current.set(event.sessionKey, mapped);
        return mapped;
      }

      const existing = routesRef.current.get(event.sessionKey);
      if (existing) {
        return existing;
      }

      const pending = creatingRouteRef.current.get(event.sessionKey);
      if (pending) {
        return pending;
      }

      const resolver = (async () => {
        const workspace = resolveDefaultWorkspace();
        if (!workspace) {
          return null;
        }
        const threadId = await startThreadForWorkspace(workspace.id);
        if (!threadId) {
          return null;
        }
        const route: SessionRoute = {
          sessionKey: event.sessionKey,
          channel: event.channel,
          chatId: event.chatId,
          workspaceId: workspace.id,
          threadId,
        };
        await sendNanobotBridgeCommand({
          type: "bind-session",
          sessionKey: route.sessionKey,
          channel: route.channel,
          chatId: route.chatId,
          workspaceId: route.workspaceId,
          threadId: route.threadId,
        });
        routesRef.current.set(route.sessionKey, route);
        return route;
      })()
        .catch(() => null)
        .finally(() => {
          creatingRouteRef.current.delete(event.sessionKey);
        });

      creatingRouteRef.current.set(event.sessionKey, resolver);
      return resolver;
    },
    [resolveDefaultWorkspace, startThreadForWorkspace],
  );

  const tryHandleControlCommand = useCallback(
    async (event: Extract<NanobotBridgeEvent, { type: "remote-message" }>, raw: string) => {
      if (isMenuCommand(raw)) {
        const mode = sessionModeRef.current.get(event.sessionKey) ?? "bridge";
        await sendBridgeReply(event, buildMenuText(mode));
        return true;
      }

      const mode = parseModeCommand(raw);
      if (mode) {
        sessionModeRef.current.set(event.sessionKey, mode);
        await sendBridgeReply(
          event,
          mode === "agent"
            ? "Mode switched to agent."
            : "Mode switched to bridge.",
        );
        return true;
      }

      const relayIndex = parseRelayCommand(raw);
      if (relayIndex === undefined) {
        return false;
      }

      const candidates = getRelayCandidates();
      if (!candidates.length) {
        await sendBridgeReply(event, "No open sessions available for relay.");
        return true;
      }

      if (relayIndex === null) {
        relayOptionsRef.current.set(event.sessionKey, candidates);
        const listText = candidates
          .map((candidate, index) => `${index + 1}. ${candidate.title}`)
          .join("\n");
        await sendBridgeReply(
          event,
          `Relay sessions:\n${listText}\n\nSend /relay <number> to bind this chat.`,
        );
        return true;
      }

      const available = relayOptionsRef.current.get(event.sessionKey) ?? candidates;
      const selected = available[relayIndex - 1];
      if (!selected) {
        await sendBridgeReply(event, `Invalid relay index: ${relayIndex}`);
        return true;
      }

      const route: SessionRoute = {
        sessionKey: event.sessionKey,
        channel: event.channel,
        chatId: event.chatId,
        workspaceId: selected.workspaceId,
        threadId: selected.threadId,
      };
      await sendNanobotBridgeCommand({
        type: "bind-session",
        sessionKey: route.sessionKey,
        channel: route.channel,
        chatId: route.chatId,
        workspaceId: route.workspaceId,
        threadId: route.threadId,
      });
      routesRef.current.set(route.sessionKey, route);
      sessionModeRef.current.set(route.sessionKey, "bridge");
      await sendBridgeReply(event, `Relay bound: ${selected.title}`);
      return true;
    },
    [getRelayCandidates, sendBridgeReply],
  );

  const handleEvent = useCallback(
    (event: NanobotBridgeEvent) => {
      if (!enabled || event.type !== "remote-message") {
        return;
      }
      const content = event.content.trim();
      if (!content) {
        return;
      }
      void (async () => {
        if (await tryHandleControlCommand(event, content)) {
          return;
        }

        const mode = sessionModeRef.current.get(event.sessionKey) ?? "bridge";
        if (mode === "agent") {
          await sendBridgeReply(event, AGENT_MODE_REPLY);
          return;
        }

        const route = await ensureRoute(event);
        if (!route) {
          return;
        }
        const workspace = workspaces.find(
          (candidate) => candidate.id === route.workspaceId,
        );
        if (!workspace) {
          return;
        }
        await sendUserMessageToThread(workspace, route.threadId, content, [], {
          skipPromptExpansion: true,
          skipHappyBridgeEcho: true,
        });
      })();
    },
    [
      enabled,
      ensureRoute,
      sendBridgeReply,
      sendUserMessageToThread,
      tryHandleControlCommand,
      workspaces,
    ],
  );

  useTauriEvent(subscribeNanobotBridgeEvents, handleEvent, { enabled });
}
