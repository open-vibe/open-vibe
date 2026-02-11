import { useCallback, useEffect, useRef } from "react";
import type {
  AccessMode,
  AppSettings,
  NanobotBridgeEvent,
  ThreadSummary,
  WorkspaceInfo,
} from "../../../types";
import { getNanobotConfigPath, sendNanobotBridgeCommand } from "../../../services/tauri";
import { subscribeNanobotBridgeEvents } from "../../../services/events";
import { useTauriEvent } from "../../app/hooks/useTauriEvent";
import type { ThreadTab } from "../../app/hooks/useThreadTabs";
import type { TranslationKey, TranslationParams } from "../../../i18n";

type NanobotBridgeTranslator = (
  key: TranslationKey,
  params?: TranslationParams,
) => string;

type UseNanobotBridgeEventsOptions = {
  enabled: boolean;
  sessionMemoryEnabled: boolean;
  defaultMode: SessionMode;
  workspaces: WorkspaceInfo[];
  nanobotWorkspaceId: string | null;
  openThreadTabs: ThreadTab[];
  threadsByWorkspace: Record<string, ThreadSummary[]>;
  appSettings: AppSettings;
  t: NanobotBridgeTranslator;
  addWorkspaceFromPath: (path: string) => Promise<WorkspaceInfo | null>;
  connectWorkspace: (workspace: WorkspaceInfo) => Promise<void>;
  openWorkspaceTab: (workspaceId: string) => void;
  openThreadTab: (workspaceId: string, threadId: string) => void;
  closeThreadTab: (workspaceId: string, threadId: string) => boolean;
  updateSettings: (patch: Partial<AppSettings>) => Promise<boolean>;
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

type ThreadTargetResolution = {
  thread: ThreadSummary | null;
  ambiguous: ThreadSummary[];
};

type OpenVibeSettingKey =
  | "compactSidebar"
  | "refreshThreadsOnFocus"
  | "nanobotSessionMemoryEnabled"
  | "nanobotMode";

type OpenVibeControlAction =
  | { type: "help" }
  | { type: "workspace-list" }
  | { type: "workspace-open"; workspace: string }
  | { type: "thread-list"; workspace?: string }
  | { type: "thread-open"; workspace?: string; thread: string }
  | { type: "thread-focus"; workspace?: string; thread: string }
  | { type: "thread-close"; workspace?: string; thread: string }
  | { type: "settings-get"; key?: OpenVibeSettingKey }
  | { type: "settings-set"; key: OpenVibeSettingKey; value: string };

const OPENVIBE_SETTING_LABEL_KEYS: Record<OpenVibeSettingKey, TranslationKey> = {
  compactSidebar: "nanobot.bridge.ov.setting.label.compactSidebar",
  refreshThreadsOnFocus: "nanobot.bridge.ov.setting.label.refreshThreadsOnFocus",
  nanobotSessionMemoryEnabled: "nanobot.bridge.ov.setting.label.nanobotSessionMemoryEnabled",
  nanobotMode: "nanobot.bridge.ov.setting.label.nanobotMode",
};

const NANOBOT_SESSION_STATE_STORAGE_KEY = "openvibe.nanobot.sessionState.v1";
const NANOBOT_THREAD_IDS_STORAGE_KEY = "openvibe.nanobot.threadIds.v1";

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

function splitWords(raw: string) {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function parseBooleanValue(raw: string): boolean | null {
  const lower = raw.trim().toLowerCase();
  if (
    lower === "1" ||
    lower === "true" ||
    lower === "on" ||
    lower === "yes" ||
    lower === "enable" ||
    lower === "enabled" ||
    raw.trim() === "开" ||
    raw.trim() === "开启" ||
    raw.trim() === "打开" ||
    raw.trim() === "启用"
  ) {
    return true;
  }
  if (
    lower === "0" ||
    lower === "false" ||
    lower === "off" ||
    lower === "no" ||
    lower === "disable" ||
    lower === "disabled" ||
    raw.trim() === "关" ||
    raw.trim() === "关闭" ||
    raw.trim() === "停用" ||
    raw.trim() === "禁用"
  ) {
    return false;
  }
  if (/(开启|打开|启用|\bon\b|\benable\b|\benabled\b|\btrue\b)/i.test(raw)) {
    return true;
  }
  if (/(关闭|禁用|停用|\boff\b|\bdisable\b|\bdisabled\b|\bfalse\b)/i.test(raw)) {
    return false;
  }
  return null;
}

function resolveSettingKey(raw: string): OpenVibeSettingKey | null {
  const value = raw.trim().toLowerCase();
  if (!value) {
    return null;
  }
  if (value === "compactsidebar" || value === "compact" || value === "紧凑侧边栏") {
    return "compactSidebar";
  }
  if (
    value === "refreshthreadsonfocus" ||
    value === "focusrefresh" ||
    value === "focus刷新" ||
    value === "窗口聚焦刷新"
  ) {
    return "refreshThreadsOnFocus";
  }
  if (
    value === "nanobotsessionmemoryenabled" ||
    value === "sessionmemory" ||
    value === "会话记忆"
  ) {
    return "nanobotSessionMemoryEnabled";
  }
  if (value === "nanobotmode" || value === "mode" || value === "模式") {
    return "nanobotMode";
  }
  return null;
}

function parseOpenVibeAction(raw: string): OpenVibeControlAction | null {
  const trimmed = raw.trim();
  const ovMatch = trimmed.match(/^\/ov(?:\s+(.+))?$/i);
  if (ovMatch) {
    const body = (ovMatch[1] ?? "").trim();
    if (!body || body.toLowerCase() === "help") {
      return { type: "help" };
    }
    const parts = splitWords(body);
    const [subject, command, ...rest] = parts;
    const subjectLower = subject?.toLowerCase();
    const commandLower = command?.toLowerCase();

    if (
      subjectLower === "workspace" &&
      (commandLower === "list" || commandLower === "ls")
    ) {
      return { type: "workspace-list" };
    }
    if (subjectLower === "workspace" && commandLower === "open" && rest[0]) {
      return { type: "workspace-open", workspace: rest.join(" ") };
    }
    if (subjectLower === "thread" && (commandLower === "list" || commandLower === "ls")) {
      return { type: "thread-list", workspace: rest.join(" ").trim() || undefined };
    }
    if (
      subjectLower === "thread" &&
      (commandLower === "open" || commandLower === "focus" || commandLower === "close") &&
      rest[0]
    ) {
      const first = rest[0];
      const hasWorkspaceToken =
        rest.length >= 2 &&
        (/^\d+$/.test(first) || /^[0-9a-f]{8}-[0-9a-f-]{8,}$/i.test(first));
      const threadValue = hasWorkspaceToken ? rest.slice(1).join(" ") : rest.join(" ");
      if (commandLower === "open") {
        return {
          type: "thread-open",
          workspace: hasWorkspaceToken ? first : undefined,
          thread: threadValue,
        };
      }
      if (commandLower === "focus") {
        return {
          type: "thread-focus",
          workspace: hasWorkspaceToken ? first : undefined,
          thread: threadValue,
        };
      }
      return {
        type: "thread-close",
        workspace: hasWorkspaceToken ? first : undefined,
        thread: threadValue,
      };
    }
    if (subjectLower === "settings" && commandLower === "get") {
      return { type: "settings-get", key: resolveSettingKey(rest.join(" ")) ?? undefined };
    }
    if (subjectLower === "settings" && commandLower === "set" && rest.length >= 2) {
      const key = resolveSettingKey(rest[0]);
      if (!key) {
        return null;
      }
      return {
        type: "settings-set",
        key,
        value: rest.slice(1).join(" "),
      };
    }
    return null;
  }

  const lower = trimmed.toLowerCase();
  if (
    /(openvibe|ov|工作区|workspace)/i.test(trimmed) &&
    /(list|show|查看|列出|有哪些)/i.test(trimmed) &&
    /(workspace|工作区)/i.test(trimmed)
  ) {
    return { type: "workspace-list" };
  }

  if (
    /(openvibe|ov|线程|对话|thread)/i.test(trimmed) &&
    /(list|show|查看|列出|有哪些)/i.test(trimmed) &&
    /(thread|线程|对话)/i.test(trimmed)
  ) {
    return { type: "thread-list" };
  }

  const openIndexMatch = trimmed.match(
    /(打开|切换到|聚焦|open|focus)\s*第?\s*(\d+)\s*(个)?\s*(线程|对话|thread)?/i,
  );
  if (openIndexMatch) {
    return { type: "thread-focus", thread: openIndexMatch[2] };
  }

  const closeIndexMatch = trimmed.match(
    /(关闭|关掉|close)\s*第?\s*(\d+)\s*(个)?\s*(线程|对话|tab|标签)?/i,
  );
  if (closeIndexMatch) {
    return { type: "thread-close", thread: closeIndexMatch[2] };
  }

  if (
    /(紧凑|compact).*(侧边栏|sidebar)/i.test(trimmed) &&
    /(开启|打开|启用|关闭|禁用|on|off|enable|disable)/i.test(trimmed)
  ) {
    const bool = parseBooleanValue(trimmed);
    if (bool !== null) {
      return {
        type: "settings-set",
        key: "compactSidebar",
        value: bool ? "on" : "off",
      };
    }
  }

  if (
    /(focus|聚焦|窗口激活).*(刷新|refresh)/i.test(trimmed) &&
    /(开启|打开|启用|关闭|禁用|on|off|enable|disable)/i.test(trimmed)
  ) {
    const bool = parseBooleanValue(trimmed);
    if (bool !== null) {
      return {
        type: "settings-set",
        key: "refreshThreadsOnFocus",
        value: bool ? "on" : "off",
      };
    }
  }

  if (/(设置|settings).*(查看|显示|show|get)/i.test(trimmed)) {
    return { type: "settings-get" };
  }

  if (lower === "ov帮助" || lower === "openvibe help") {
    return { type: "help" };
  }
  return null;
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

type PersistedThreadIdsByWorkspace = Record<string, string[]>;

function readPersistedThreadIdsByWorkspace(): PersistedThreadIdsByWorkspace {
  if (typeof window === "undefined") {
    return {};
  }
  const raw = window.localStorage.getItem(NANOBOT_THREAD_IDS_STORAGE_KEY);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const normalized: PersistedThreadIdsByWorkspace = {};
    Object.entries(parsed).forEach(([workspaceId, threadIds]) => {
      if (!Array.isArray(threadIds)) {
        return;
      }
      const unique = Array.from(
        new Set(
          threadIds
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter((item) => item.length > 0),
        ),
      );
      if (unique.length > 0) {
        normalized[workspaceId] = unique;
      }
    });
    return normalized;
  } catch {
    return {};
  }
}

function persistThreadIdsByWorkspace(value: PersistedThreadIdsByWorkspace) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    NANOBOT_THREAD_IDS_STORAGE_KEY,
    JSON.stringify(value),
  );
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
  threadsByWorkspace,
  appSettings,
  t,
  addWorkspaceFromPath,
  connectWorkspace,
  openWorkspaceTab,
  openThreadTab,
  closeThreadTab,
  updateSettings,
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
  const warmThreadIdRef = useRef<string | null>(null);
  const warmThreadTaskRef = useRef<Promise<void> | null>(null);
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

  const rememberNanobotThread = useCallback((workspaceId: string, threadId: string) => {
    const normalizedWorkspaceId = workspaceId.trim();
    const normalizedThreadId = threadId.trim();
    if (!normalizedWorkspaceId || !normalizedThreadId || typeof window === "undefined") {
      return;
    }
    const current = readPersistedThreadIdsByWorkspace();
    const next = new Set(current[normalizedWorkspaceId] ?? []);
    next.add(normalizedThreadId);
    current[normalizedWorkspaceId] = Array.from(next);
    persistThreadIdsByWorkspace(current);
  }, []);

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
      warmThreadIdRef.current = null;
      warmThreadTaskRef.current = null;
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

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (warmThreadTaskRef.current) {
      return;
    }
    const task = (async () => {
      const workspace = await ensureNanobotWorkspace();
      if (!workspace) {
        return;
      }
      const hasRoute = Array.from(routesRef.current.values()).some(
        (route) => route.workspaceId === workspace.id,
      );
      if (hasRoute || warmThreadIdRef.current) {
        return;
      }
      if (!workspace.connected) {
        await connectWorkspace(workspace);
      }
      const threadId = await startThreadForWorkspace(workspace.id);
      if (threadId) {
        warmThreadIdRef.current = threadId;
        rememberNanobotThread(workspace.id, threadId);
      }
    })().finally(() => {
      warmThreadTaskRef.current = null;
    });
    warmThreadTaskRef.current = task;
  }, [
    enabled,
    ensureNanobotWorkspace,
    connectWorkspace,
    rememberNanobotThread,
    startThreadForWorkspace,
  ]);

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

  const resolveWorkspaceTarget = useCallback(
    (target: string | undefined, fallbackWorkspaceId: string | null) => {
      const normalized = target?.trim();
      if (!normalized) {
        if (fallbackWorkspaceId) {
          return workspaces.find((workspace) => workspace.id === fallbackWorkspaceId) ?? null;
        }
        return resolveNanobotWorkspace();
      }
      if (/^\d+$/.test(normalized)) {
        const index = Number(normalized) - 1;
        return workspaces[index] ?? null;
      }
      const lower = normalized.toLowerCase();
      return (
        workspaces.find((workspace) => workspace.id === normalized) ??
        workspaces.find((workspace) => workspace.name.toLowerCase() === lower) ??
        workspaces.find((workspace) => workspace.name.toLowerCase().includes(lower)) ??
        null
      );
    },
    [resolveNanobotWorkspace, workspaces],
  );

  const resolveThreadTarget = useCallback(
    (workspaceId: string, target: string): ThreadTargetResolution => {
      const threads = threadsByWorkspace[workspaceId] ?? [];
      const normalized = target.trim();
      if (!normalized) {
        return { thread: null, ambiguous: [] };
      }
      if (/^\d+$/.test(normalized)) {
        const index = Number(normalized) - 1;
        return { thread: threads[index] ?? null, ambiguous: [] };
      }
      const lower = normalized.toLowerCase();
      const exactId = threads.find((thread) => thread.id === normalized);
      if (exactId) {
        return { thread: exactId, ambiguous: [] };
      }
      const exactName = threads.find((thread) => thread.name.toLowerCase() === lower);
      if (exactName) {
        return { thread: exactName, ambiguous: [] };
      }
      const idPrefixMatches = threads.filter((thread) =>
        thread.id.toLowerCase().startsWith(lower),
      );
      if (idPrefixMatches.length === 1) {
        return { thread: idPrefixMatches[0], ambiguous: [] };
      }
      if (idPrefixMatches.length > 1) {
        return { thread: null, ambiguous: idPrefixMatches.slice(0, 10) };
      }
      const nameContainsMatches = threads.filter((thread) =>
        thread.name.toLowerCase().includes(lower),
      );
      if (nameContainsMatches.length === 1) {
        return { thread: nameContainsMatches[0], ambiguous: [] };
      }
      if (nameContainsMatches.length > 1) {
        return { thread: null, ambiguous: nameContainsMatches.slice(0, 10) };
      }
      return { thread: null, ambiguous: [] };
    },
    [threadsByWorkspace],
  );

  const hasThreadInWorkspace = useCallback(
    (workspaceId: string, threadId: string): boolean | null => {
      const threads = threadsByWorkspace[workspaceId];
      if (!threads) {
        return null;
      }
      return threads.some((thread) => thread.id === threadId);
    },
    [threadsByWorkspace],
  );

  const resolveThreadTargetAcrossWorkspaces = useCallback(
    (target: string) => {
      const matches: { workspace: WorkspaceInfo; thread: ThreadSummary }[] = [];
      for (const workspace of workspaces) {
        const resolved = resolveThreadTarget(workspace.id, target);
        if (resolved.thread) {
          matches.push({ workspace, thread: resolved.thread });
        }
      }
      if (matches.length === 1) {
        return { match: matches[0], ambiguous: [] as typeof matches };
      }
      if (matches.length > 1) {
        return { match: null, ambiguous: matches.slice(0, 10) };
      }
      return { match: null, ambiguous: [] as typeof matches };
    },
    [resolveThreadTarget, workspaces],
  );

  const bindSessionRoute = useCallback(
    async (route: SessionRoute) => {
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
      rememberNanobotThread(route.workspaceId, route.threadId);
      persistSessionState();
      await syncSessionMode(route.sessionKey, getSessionMode(route.sessionKey));
    },
    [getSessionMode, persistSessionState, rememberNanobotThread, syncSessionMode],
  );

  const formatSettingValue = useCallback(
    (key: OpenVibeSettingKey) => {
      switch (key) {
        case "compactSidebar":
          return String(appSettings.compactSidebar);
        case "refreshThreadsOnFocus":
          return String(appSettings.refreshThreadsOnFocus);
        case "nanobotSessionMemoryEnabled":
          return String(appSettings.nanobotSessionMemoryEnabled);
        case "nanobotMode":
          return appSettings.nanobotMode;
        default:
          return "";
      }
    },
    [appSettings],
  );

  const buildOpenVibeHelp = useCallback(
    () =>
      [
        t("nanobot.bridge.ov.help.title"),
        `- /ov workspace list`,
        `- /ov workspace open 1`,
        `- /ov thread list`,
        `- /ov thread focus 2`,
        `- /ov thread open new`,
        `- /ov thread close 2`,
        `- /ov settings get`,
        `- /ov settings set compactSidebar on`,
      ].join("\n"),
    [t],
  );

  const handleOpenVibeControl = useCallback(
    async (event: Extract<NanobotBridgeEvent, { type: "remote-message" }>, raw: string) => {
      const action = parseOpenVibeAction(raw);
      if (!action) {
        return false;
      }
      if (action.type === "help") {
        await sendBridgeReply(event, buildOpenVibeHelp());
        return true;
      }

      const existingRoute = routesRef.current.get(event.sessionKey) ?? null;
      const fallbackWorkspaceId = existingRoute?.workspaceId ?? event.workspaceId ?? null;

      if (action.type === "workspace-list") {
        if (!workspaces.length) {
          await sendBridgeReply(event, t("nanobot.bridge.ov.reply.noWorkspaces"));
          return true;
        }
        const lines = workspaces.map(
          (workspace, index) =>
            `${index + 1}. ${workspace.name} (${workspace.connected ? "connected" : "disconnected"})`,
        );
        await sendBridgeReply(
          event,
          `${t("nanobot.bridge.ov.reply.workspaceListHeader")}\n${lines.join("\n")}`,
        );
        return true;
      }

      if (action.type === "workspace-open") {
        const workspace = resolveWorkspaceTarget(action.workspace, fallbackWorkspaceId);
        if (!workspace) {
          await sendBridgeReply(event, t("nanobot.bridge.ov.reply.workspaceNotFound"));
          return true;
        }
        openWorkspaceTab(workspace.id);
        await sendBridgeReply(
          event,
          t("nanobot.bridge.ov.reply.workspaceOpened", { value: workspace.name }),
        );
        return true;
      }

      if (action.type === "thread-list") {
        const workspace = resolveWorkspaceTarget(action.workspace, fallbackWorkspaceId);
        if (!workspace) {
          await sendBridgeReply(event, t("nanobot.bridge.ov.reply.workspaceNotFound"));
          return true;
        }
        const threads = threadsByWorkspace[workspace.id] ?? [];
        if (!threads.length) {
          await sendBridgeReply(
            event,
            t("nanobot.bridge.ov.reply.noThreads", { value: workspace.name }),
          );
          return true;
        }
        const lines = threads.map(
          (thread, index) => `${index + 1}. ${thread.name} (${thread.id.slice(0, 8)})`,
        );
        await sendBridgeReply(
          event,
          `${t("nanobot.bridge.ov.reply.threadListHeader", { value: workspace.name })}\n${lines.join("\n")}`,
        );
        return true;
      }

      if (
        action.type === "thread-open" ||
        action.type === "thread-focus" ||
        action.type === "thread-close"
      ) {
        const hasExplicitWorkspace = Boolean(action.workspace?.trim());
        const workspace = resolveWorkspaceTarget(action.workspace, fallbackWorkspaceId);
        if (!workspace) {
          await sendBridgeReply(event, t("nanobot.bridge.ov.reply.workspaceNotFound"));
          return true;
        }

        if (
          (action.type === "thread-open" || action.type === "thread-focus") &&
          action.thread.trim().toLowerCase() === "new"
        ) {
          const threadId = await startThreadForWorkspace(workspace.id);
          if (!threadId) {
            await sendBridgeReply(event, t("nanobot.bridge.ov.reply.threadNotFound"));
            return true;
          }
          openThreadTab(workspace.id, threadId);
          await bindSessionRoute({
            sessionKey: event.sessionKey,
            channel: event.channel,
            chatId: event.chatId,
            workspaceId: workspace.id,
            threadId,
          });
          await sendBridgeReply(
            event,
            t("nanobot.bridge.ov.reply.threadOpened", { value: threadId.slice(0, 8) }),
          );
          return true;
        }

        let resolvedWorkspace = workspace;
        let threadResolution = resolveThreadTarget(resolvedWorkspace.id, action.thread);
        if (!hasExplicitWorkspace) {
          const globalResolved = resolveThreadTargetAcrossWorkspaces(action.thread);
          if (globalResolved.match) {
            resolvedWorkspace = globalResolved.match.workspace;
            threadResolution = {
              thread: globalResolved.match.thread,
              ambiguous: [],
            };
          } else if (globalResolved.ambiguous.length > 1) {
            const lines = globalResolved.ambiguous.map(
              (item, index) =>
                `${index + 1}. ${item.workspace.name} / ${item.thread.name} (${item.thread.id.slice(0, 8)})`,
            );
            await sendBridgeReply(
              event,
              `${t("nanobot.bridge.ov.reply.threadAmbiguousHeader")}\n${lines.join("\n")}\n${t("nanobot.bridge.ov.reply.threadAmbiguousHint")}`,
            );
            return true;
          }
        } else if (!threadResolution.thread) {
          const globalResolved = resolveThreadTargetAcrossWorkspaces(action.thread);
          if (globalResolved.match) {
            resolvedWorkspace = globalResolved.match.workspace;
            threadResolution = {
              thread: globalResolved.match.thread,
              ambiguous: [],
            };
          } else if (globalResolved.ambiguous.length > 1) {
            const lines = globalResolved.ambiguous.map(
              (item, index) =>
                `${index + 1}. ${item.workspace.name} / ${item.thread.name} (${item.thread.id.slice(0, 8)})`,
            );
            await sendBridgeReply(
              event,
              `${t("nanobot.bridge.ov.reply.threadAmbiguousHeader")}\n${lines.join("\n")}\n${t("nanobot.bridge.ov.reply.threadAmbiguousHint")}`,
            );
            return true;
          }
        }
        const thread = threadResolution.thread;
        if (!thread && threadResolution.ambiguous.length > 0) {
          const lines = threadResolution.ambiguous.map(
            (item, index) => `${index + 1}. ${item.name} (${item.id.slice(0, 8)})`,
          );
          await sendBridgeReply(
            event,
            `${t("nanobot.bridge.ov.reply.threadAmbiguousHeader")}\n${lines.join("\n")}\n${t("nanobot.bridge.ov.reply.threadAmbiguousHint")}`,
          );
          return true;
        }
        if (!thread) {
          await sendBridgeReply(event, t("nanobot.bridge.ov.reply.threadNotFound"));
          return true;
        }

        if (action.type === "thread-close") {
          const closed = closeThreadTab(resolvedWorkspace.id, thread.id);
          await sendBridgeReply(
            event,
            closed
              ? t("nanobot.bridge.ov.reply.threadClosed", { value: thread.name })
              : t("nanobot.bridge.ov.reply.threadCloseNotOpen", {
                  value: thread.name,
                }),
          );
          return true;
        }

        openThreadTab(resolvedWorkspace.id, thread.id);
        await bindSessionRoute({
          sessionKey: event.sessionKey,
          channel: event.channel,
          chatId: event.chatId,
          workspaceId: resolvedWorkspace.id,
          threadId: thread.id,
        });
        await sendBridgeReply(
          event,
          t("nanobot.bridge.ov.reply.threadOpened", { value: thread.name }),
        );
        return true;
      }

      if (action.type === "settings-get") {
        if (action.key) {
          await sendBridgeReply(
            event,
            t("nanobot.bridge.ov.reply.settingsValue", {
              key: action.key,
              value: formatSettingValue(action.key),
            }),
          );
          return true;
        }
        const keys: OpenVibeSettingKey[] = [
          "compactSidebar",
          "refreshThreadsOnFocus",
          "nanobotSessionMemoryEnabled",
          "nanobotMode",
        ];
        const lines = keys.map(
          (key) =>
            `- ${t(OPENVIBE_SETTING_LABEL_KEYS[key])}: ${formatSettingValue(key)}`,
        );
        await sendBridgeReply(
          event,
          `${t("nanobot.bridge.ov.reply.settingsListHeader")}\n${lines.join("\n")}`,
        );
        return true;
      }

      if (action.type === "settings-set") {
        if (action.key === "nanobotMode") {
          const modeValue = action.value.trim().toLowerCase();
          if (modeValue !== "bridge" && modeValue !== "agent") {
            await sendBridgeReply(event, t("nanobot.bridge.ov.reply.settingsValueInvalid"));
            return true;
          }
          const changed = await updateSettings({ nanobotMode: modeValue });
          if (changed) {
            await syncSessionMode(event.sessionKey, modeValue);
          }
          await sendBridgeReply(
            event,
            t("nanobot.bridge.ov.reply.settingsUpdated", {
              key: t("nanobot.bridge.ov.setting.label.nanobotMode"),
              value: modeValue,
            }),
          );
          return true;
        }
        const parsed = parseBooleanValue(action.value);
        if (parsed === null) {
          await sendBridgeReply(event, t("nanobot.bridge.ov.reply.settingsValueInvalid"));
          return true;
        }
        const patch =
          action.key === "compactSidebar"
            ? { compactSidebar: parsed }
            : action.key === "refreshThreadsOnFocus"
              ? { refreshThreadsOnFocus: parsed }
              : { nanobotSessionMemoryEnabled: parsed };
        await updateSettings(patch);
        await sendBridgeReply(
          event,
          t("nanobot.bridge.ov.reply.settingsUpdated", {
            key: t(OPENVIBE_SETTING_LABEL_KEYS[action.key]),
            value: String(parsed),
          }),
        );
        return true;
      }
      return false;
    },
    [
      bindSessionRoute,
      buildOpenVibeHelp,
      closeThreadTab,
      formatSettingValue,
      openThreadTab,
      openWorkspaceTab,
      resolveThreadTarget,
      resolveThreadTargetAcrossWorkspaces,
      resolveWorkspaceTarget,
      sendBridgeReply,
      startThreadForWorkspace,
      syncSessionMode,
      t,
      threadsByWorkspace,
      updateSettings,
      workspaces,
    ],
  );

  const ensureRoute = useCallback(
    async (
      event: Extract<NanobotBridgeEvent, { type: "remote-message" }>,
    ): Promise<SessionRoute | null> => {
      const preferredWorkspace = await ensureNanobotWorkspace();
      if (!preferredWorkspace) {
        throw new Error("Nanobot workspace is unavailable.");
      }
      const preferredWorkspaceId = preferredWorkspace.id;
      const reuseRouteForChat = () =>
        Array.from(routesRef.current.values()).find(
          (route) =>
            route.channel === event.channel &&
            route.chatId === event.chatId &&
            route.workspaceId === preferredWorkspaceId,
        ) ?? null;
      const inheritSessionMode = (fromSessionKey: string, toSessionKey: string) => {
        if (fromSessionKey === toSessionKey) {
          return;
        }
        if (sessionModeRef.current.has(toSessionKey)) {
          return;
        }
        const inheritedMode = sessionModeRef.current.get(fromSessionKey);
        if (inheritedMode) {
          sessionModeRef.current.set(toSessionKey, inheritedMode);
        }
      };
      const mappedWorkspaceId = event.workspaceId?.trim();
      const mappedThreadId = event.threadId?.trim();
      if (
        mappedWorkspaceId &&
        mappedThreadId &&
        preferredWorkspaceId &&
        mappedWorkspaceId === preferredWorkspaceId
      ) {
        const mappedThreadExists = hasThreadInWorkspace(
          mappedWorkspaceId,
          mappedThreadId,
        );
        if (mappedThreadExists !== false) {
          const mapped: SessionRoute = {
            sessionKey: event.sessionKey,
            channel: event.channel,
            chatId: event.chatId,
            workspaceId: mappedWorkspaceId,
            threadId: mappedThreadId,
          };
          routesRef.current.set(event.sessionKey, mapped);
          boundSessionKeysRef.current.add(event.sessionKey);
          rememberNanobotThread(mapped.workspaceId, mapped.threadId);
          persistSessionState();
          return mapped;
        }
      }

      const existing = routesRef.current.get(event.sessionKey);
      if (existing) {
        const existingThreadExists = hasThreadInWorkspace(
          existing.workspaceId,
          existing.threadId,
        );
        if (existingThreadExists === false) {
          routesRef.current.delete(event.sessionKey);
          boundSessionKeysRef.current.delete(event.sessionKey);
          persistSessionState();
        } else if (existing.workspaceId !== preferredWorkspaceId) {
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

      const reusable = reuseRouteForChat();
      if (reusable && hasThreadInWorkspace(reusable.workspaceId, reusable.threadId) !== false) {
        inheritSessionMode(reusable.sessionKey, event.sessionKey);
        const reusedRoute: SessionRoute = {
          sessionKey: event.sessionKey,
          channel: event.channel,
          chatId: event.chatId,
          workspaceId: reusable.workspaceId,
          threadId: reusable.threadId,
        };
        if (!boundSessionKeysRef.current.has(event.sessionKey)) {
          await sendNanobotBridgeCommand({
            type: "bind-session",
            sessionKey: reusedRoute.sessionKey,
            channel: reusedRoute.channel,
            chatId: reusedRoute.chatId,
            workspaceId: reusedRoute.workspaceId,
            threadId: reusedRoute.threadId,
          });
          await syncSessionMode(
            reusedRoute.sessionKey,
            getSessionMode(reusedRoute.sessionKey),
          );
          boundSessionKeysRef.current.add(event.sessionKey);
        }
        routesRef.current.set(event.sessionKey, reusedRoute);
        rememberNanobotThread(reusedRoute.workspaceId, reusedRoute.threadId);
        persistSessionState();
        return reusedRoute;
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
        const threadId =
          warmThreadIdRef.current ?? (await startThreadForWorkspace(workspace.id));
        if (warmThreadIdRef.current === threadId) {
          warmThreadIdRef.current = null;
        }
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
        rememberNanobotThread(route.workspaceId, route.threadId);
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
      hasThreadInWorkspace,
      rememberNanobotThread,
      startThreadForWorkspace,
      syncSessionMode,
      persistSessionState,
    ],
  );

  const tryHandleControlCommand = useCallback(
    async (event: Extract<NanobotBridgeEvent, { type: "remote-message" }>, raw: string) => {
      if (await handleOpenVibeControl(event, raw)) {
        return true;
      }

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
      rememberNanobotThread(route.workspaceId, route.threadId);
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
      handleOpenVibeControl,
      rememberNanobotThread,
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
