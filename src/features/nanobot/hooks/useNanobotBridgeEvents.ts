import { useCallback, useEffect, useRef } from "react";
import type {
  AccessMode,
  NanobotBridgeEvent,
  WorkspaceInfo,
} from "../../../types";
import { getNanobotConfigPath, sendNanobotBridgeCommand } from "../../../services/tauri";
import { subscribeNanobotBridgeEvents } from "../../../services/events";
import { useTauriEvent } from "../../app/hooks/useTauriEvent";
import type { ThreadTab } from "../../app/hooks/useThreadTabs";

type NanobotBridgeTranslationKey =
  | "nanobot.bridge.menu.title"
  | "nanobot.bridge.menu.currentMode"
  | "nanobot.bridge.menu.mode.bridge"
  | "nanobot.bridge.menu.mode.agent"
  | "nanobot.bridge.menu.action.relayMode"
  | "nanobot.bridge.menu.action.agentMode"
  | "nanobot.bridge.menu.action.listRelay"
  | "nanobot.bridge.menu.action.pickRelay"
  | "nanobot.bridge.reply.agentMode"
  | "nanobot.bridge.reply.modeSwitched.agent"
  | "nanobot.bridge.reply.modeSwitched.bridge"
  | "nanobot.bridge.reply.noRelaySessions"
  | "nanobot.bridge.reply.relaySessionsHeader"
  | "nanobot.bridge.reply.relaySessionsHint"
  | "nanobot.bridge.reply.invalidRelayIndex"
  | "nanobot.bridge.reply.relayBound"
  | "nanobot.bridge.reply.unexpectedError";

type NanobotBridgeTranslator = (
  key: NanobotBridgeTranslationKey,
  params?: Record<string, string | number>,
) => string;

type UseNanobotBridgeEventsOptions = {
  enabled: boolean;
  sessionMemoryEnabled: boolean;
  defaultMode: SessionMode;
  workspaces: WorkspaceInfo[];
  nanobotWorkspaceId: string | null;
  openThreadTabs: ThreadTab[];
  t: NanobotBridgeTranslator;
  addWorkspaceFromPath: (path: string) => Promise<WorkspaceInfo | null>;
  connectWorkspace: (workspace: WorkspaceInfo) => Promise<void>;
  startThreadForWorkspace: (workspaceId: string) => Promise<string | null>;
  sendUserMessageToThread: (
    workspace: WorkspaceInfo,
    threadId: string,
    text: string,
    images?: string[],
    options?: {
      skipPromptExpansion?: boolean;
      skipHappyBridgeEcho?: boolean;
      accessMode?: AccessMode;
    },
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

type PersistedRoute = {
  channel: string;
  chatId: string;
  workspaceId: string;
  threadId: string;
};

type PersistedSessionState = {
  modes: Record<string, SessionMode>;
  routes: Record<string, PersistedRoute>;
};

const NANOBOT_SESSION_STATE_STORAGE_KEY = "openvibe.nanobot.sessionState.v1";

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

function readPersistedSessionState(): PersistedSessionState {
  if (typeof window === "undefined") {
    return { modes: {}, routes: {} };
  }
  const raw = window.localStorage.getItem(NANOBOT_SESSION_STATE_STORAGE_KEY);
  if (!raw) {
    return { modes: {}, routes: {} };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedSessionState>;
    return {
      modes: parsed.modes ?? {},
      routes: parsed.routes ?? {},
    };
  } catch {
    return { modes: {}, routes: {} };
  }
}

function normalizePath(path: string) {
  return path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function getConfigParentPath(configPath: string) {
  const trimmed = configPath.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash <= 0) {
    return null;
  }
  return normalized.slice(0, lastSlash);
}

export function useNanobotBridgeEvents({
  enabled,
  sessionMemoryEnabled,
  defaultMode,
  workspaces,
  nanobotWorkspaceId,
  openThreadTabs,
  t,
  addWorkspaceFromPath,
  connectWorkspace,
  startThreadForWorkspace,
  sendUserMessageToThread,
}: UseNanobotBridgeEventsOptions) {
  const routesRef = useRef<Map<string, SessionRoute>>(new Map());
  const creatingRouteRef = useRef<Map<string, Promise<SessionRoute | null>>>(
    new Map(),
  );
  const sessionModeRef = useRef<Map<string, SessionMode>>(new Map());
  const boundSessionKeysRef = useRef<Set<string>>(new Set());
  const relayOptionsRef = useRef<Map<string, RelayCandidate[]>>(new Map());
  const nanobotWorkspacePathRef = useRef<string | null>(null);
  const ensuringWorkspaceRef = useRef<Promise<WorkspaceInfo | null> | null>(null);
  const stateLoadedRef = useRef(false);
  const persistSessionState = useCallback(() => {
    if (!sessionMemoryEnabled || typeof window === "undefined") {
      return;
    }
    const modes = Object.fromEntries(sessionModeRef.current.entries());
    const routes = Object.fromEntries(
      Array.from(routesRef.current.entries()).map(([sessionKey, route]) => [
        sessionKey,
        {
          channel: route.channel,
          chatId: route.chatId,
          workspaceId: route.workspaceId,
          threadId: route.threadId,
        },
      ]),
    );
    window.localStorage.setItem(
      NANOBOT_SESSION_STATE_STORAGE_KEY,
      JSON.stringify({ modes, routes }),
    );
  }, [sessionMemoryEnabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (!sessionMemoryEnabled) {
      routesRef.current.clear();
      sessionModeRef.current.clear();
      boundSessionKeysRef.current.clear();
      creatingRouteRef.current.clear();
      relayOptionsRef.current.clear();
      stateLoadedRef.current = true;
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(NANOBOT_SESSION_STATE_STORAGE_KEY);
      }
      return;
    }
    if (stateLoadedRef.current) {
      return;
    }
    const persisted = readPersistedSessionState();
    routesRef.current = new Map(
      Object.entries(persisted.routes).map(([sessionKey, route]) => [
        sessionKey,
        {
          sessionKey,
          channel: route.channel,
          chatId: route.chatId,
          workspaceId: route.workspaceId,
          threadId: route.threadId,
        },
      ]),
    );
    sessionModeRef.current = new Map(Object.entries(persisted.modes));
    stateLoadedRef.current = true;
  }, [enabled, sessionMemoryEnabled]);

  const getSessionMode = useCallback(
    (sessionKey: string) => sessionModeRef.current.get(sessionKey) ?? defaultMode,
    [defaultMode],
  );
  const syncSessionMode = useCallback(
    async (sessionKey: string, mode: SessionMode) => {
      await sendNanobotBridgeCommand({
        type: "set-session-mode",
        sessionKey,
        mode,
      });
    },
    [],
  );
  const buildMenuText = useCallback(
    (currentMode: SessionMode) => {
      const modeLabel =
        currentMode === "agent"
          ? t("nanobot.bridge.menu.mode.agent")
          : t("nanobot.bridge.menu.mode.bridge");
      return [
        t("nanobot.bridge.menu.title"),
        t("nanobot.bridge.menu.currentMode", { value: modeLabel }),
        "",
        `- ${t("nanobot.bridge.menu.action.relayMode")}: /mode bridge`,
        `- ${t("nanobot.bridge.menu.action.agentMode")}: /mode agent`,
        `- ${t("nanobot.bridge.menu.action.listRelay")}: /relay`,
        `- ${t("nanobot.bridge.menu.action.pickRelay")}: /relay 1`,
      ].join("\n");
    },
    [t],
  );

  const resolveNanobotWorkspace = useCallback(() => {
    if (!workspaces.length) {
      return null;
    }
    if (nanobotWorkspaceId) {
      const byId = workspaces.find((workspace) => workspace.id === nanobotWorkspaceId);
      if (byId) {
        return byId;
      }
    }
    const expectedPath = nanobotWorkspacePathRef.current;
    if (!expectedPath) {
      return null;
    }
    const expectedKey = normalizePath(expectedPath);
    return (
      workspaces.find((workspace) => normalizePath(workspace.path) === expectedKey) ?? null
    );
  }, [nanobotWorkspaceId, workspaces]);

  const loadNanobotWorkspacePath = useCallback(async () => {
    if (nanobotWorkspacePathRef.current) {
      return nanobotWorkspacePathRef.current;
    }
    try {
      const configPath = await getNanobotConfigPath();
      const parentPath = getConfigParentPath(configPath);
      nanobotWorkspacePathRef.current = parentPath;
      return parentPath;
    } catch {
      nanobotWorkspacePathRef.current = null;
      return null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void loadNanobotWorkspacePath();
  }, [enabled, loadNanobotWorkspacePath]);

  const ensureNanobotWorkspace = useCallback(async () => {
    const existing = resolveNanobotWorkspace();
    if (existing) {
      return existing;
    }
    const pending = ensuringWorkspaceRef.current;
    if (pending) {
      return pending;
    }
    const createPromise = (async () => {
      const rootPath = await loadNanobotWorkspacePath();
      if (!rootPath) {
        return null;
      }
      try {
        const created = await addWorkspaceFromPath(rootPath);
        if (created) {
          return created;
        }
      } catch {
        // Ignore add failures and fall back to existing lookup.
      }
      return resolveNanobotWorkspace();
    })().finally(() => {
      ensuringWorkspaceRef.current = null;
    });
    ensuringWorkspaceRef.current = createPromise;
    return createPromise;
  }, [addWorkspaceFromPath, loadNanobotWorkspacePath, resolveNanobotWorkspace]);

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
      const preferredWorkspace = await ensureNanobotWorkspace();
      if (!preferredWorkspace) {
        throw new Error("Nanobot workspace is unavailable.");
      }
      const preferredWorkspaceId = preferredWorkspace.id;
      const mappedWorkspaceId = event.workspaceId?.trim();
      const mappedThreadId = event.threadId?.trim();
      if (
        mappedWorkspaceId &&
        mappedThreadId &&
        preferredWorkspaceId &&
        mappedWorkspaceId === preferredWorkspaceId
      ) {
        const mapped: SessionRoute = {
          sessionKey: event.sessionKey,
          channel: event.channel,
          chatId: event.chatId,
          workspaceId: mappedWorkspaceId,
          threadId: mappedThreadId,
        };
        routesRef.current.set(event.sessionKey, mapped);
        boundSessionKeysRef.current.add(event.sessionKey);
        persistSessionState();
        return mapped;
      }

      const existing = routesRef.current.get(event.sessionKey);
      if (existing) {
        if (preferredWorkspaceId && existing.workspaceId !== preferredWorkspaceId) {
          routesRef.current.delete(event.sessionKey);
          boundSessionKeysRef.current.delete(event.sessionKey);
          persistSessionState();
        } else {
          if (!boundSessionKeysRef.current.has(event.sessionKey)) {
            await sendNanobotBridgeCommand({
              type: "bind-session",
              sessionKey: existing.sessionKey,
              channel: existing.channel,
              chatId: existing.chatId,
              workspaceId: existing.workspaceId,
              threadId: existing.threadId,
            });
            await syncSessionMode(
              existing.sessionKey,
              getSessionMode(existing.sessionKey),
            );
            boundSessionKeysRef.current.add(event.sessionKey);
          }
          return existing;
        }
      }

      const pending = creatingRouteRef.current.get(event.sessionKey);
      if (pending) {
        return pending;
      }

      const resolver = (async () => {
        const workspace = preferredWorkspace;
        if (!workspace.connected) {
          await connectWorkspace(workspace);
        }
        const threadId = await startThreadForWorkspace(workspace.id);
        if (!threadId) {
          throw new Error("Failed to create thread for Nanobot route.");
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
        await syncSessionMode(route.sessionKey, getSessionMode(route.sessionKey));
        routesRef.current.set(route.sessionKey, route);
        boundSessionKeysRef.current.add(route.sessionKey);
        persistSessionState();
        return route;
      })().finally(() => {
          creatingRouteRef.current.delete(event.sessionKey);
        });

      creatingRouteRef.current.set(event.sessionKey, resolver);
      return resolver;
    },
    [
      connectWorkspace,
      ensureNanobotWorkspace,
      getSessionMode,
      startThreadForWorkspace,
      syncSessionMode,
      persistSessionState,
    ],
  );

  const tryHandleControlCommand = useCallback(
    async (event: Extract<NanobotBridgeEvent, { type: "remote-message" }>, raw: string) => {
      if (isMenuCommand(raw)) {
        const mode = getSessionMode(event.sessionKey);
        await sendBridgeReply(event, buildMenuText(mode));
        return true;
      }

      const mode = parseModeCommand(raw);
      if (mode) {
        sessionModeRef.current.set(event.sessionKey, mode);
        persistSessionState();
        await syncSessionMode(event.sessionKey, mode);
        if (mode === "agent") {
          // Pre-bind a workspace/thread route so the next inbound message can be handled directly.
          await ensureRoute(event);
        }
        await sendBridgeReply(
          event,
          mode === "agent"
            ? t("nanobot.bridge.reply.modeSwitched.agent")
            : t("nanobot.bridge.reply.modeSwitched.bridge"),
        );
        return true;
      }

      const relayIndex = parseRelayCommand(raw);
      if (relayIndex === undefined) {
        return false;
      }

      const candidates = getRelayCandidates();
      if (!candidates.length) {
        await sendBridgeReply(event, t("nanobot.bridge.reply.noRelaySessions"));
        return true;
      }

      if (relayIndex === null) {
        relayOptionsRef.current.set(event.sessionKey, candidates);
        const listText = candidates
          .map((candidate, index) => `${index + 1}. ${candidate.title}`)
          .join("\n");
        await sendBridgeReply(
          event,
          `${t("nanobot.bridge.reply.relaySessionsHeader")}\n${listText}\n\n${t("nanobot.bridge.reply.relaySessionsHint")}`,
        );
        return true;
      }

      const available = relayOptionsRef.current.get(event.sessionKey) ?? candidates;
      const selected = available[relayIndex - 1];
      if (!selected) {
        await sendBridgeReply(
          event,
          t("nanobot.bridge.reply.invalidRelayIndex", { value: relayIndex }),
        );
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
      boundSessionKeysRef.current.add(route.sessionKey);
      sessionModeRef.current.set(route.sessionKey, "bridge");
      persistSessionState();
      await syncSessionMode(route.sessionKey, "bridge");
      await sendBridgeReply(
        event,
        t("nanobot.bridge.reply.relayBound", { value: selected.title }),
      );
      return true;
    },
    [
      buildMenuText,
      ensureRoute,
      getRelayCandidates,
      getSessionMode,
      sendBridgeReply,
      syncSessionMode,
      t,
      persistSessionState,
    ],
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
        const mode = getSessionMode(event.sessionKey);
        if (mode === "agent") {
          await sendNanobotBridgeCommand({
            type: "agent-message",
            sessionKey: route.sessionKey,
            channel: route.channel,
            chatId: route.chatId,
            workspaceId: route.workspaceId,
            threadId: route.threadId,
            content,
          });
          return;
        }
        await sendUserMessageToThread(workspace, route.threadId, content, [], {
          skipPromptExpansion: true,
          skipHappyBridgeEcho: true,
          accessMode: "full-access",
        });
      })().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        void sendBridgeReply(
          event,
          t("nanobot.bridge.reply.unexpectedError", { value: message }),
        );
      });
    },
    [
      enabled,
      ensureRoute,
      getSessionMode,
      sendBridgeReply,
      sendUserMessageToThread,
      t,
      tryHandleControlCommand,
      workspaces,
    ],
  );

  useTauriEvent(subscribeNanobotBridgeEvents, handleEvent, { enabled });
}
