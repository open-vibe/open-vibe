import { useCallback, useEffect, useMemo, useState } from "react";
import type { ThreadSummary, WorkspaceInfo } from "../../../types";

const TABS_STORAGE_KEY = "openvibe.threadTabs";
const ACTIVE_TAB_STORAGE_KEY = "openvibe.activeThreadTabId";

export type ThreadTab = {
  id: string;
  workspaceId: string;
  title: string;
  lastActiveAt: number;
  loaded: boolean;
} & (
  | {
      kind: "thread";
      threadId: string;
    }
  | {
      kind: "workspace";
    }
  | {
      kind: "home";
    }
  | {
      kind: "debug-log";
    }
  | {
      kind: "nanobot-log";
    }
);

type UseThreadTabsOptions = {
  workspaces: WorkspaceInfo[];
  threadsByWorkspace: Record<string, ThreadSummary[]>;
  homeTabTitle: string;
  debugLogTabTitle: string;
  nanobotLogTabTitle: string;
};

const parseStoredTabs = (raw: string | null): ThreadTab[] => {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const tab = entry as {
          id?: unknown;
          workspaceId?: unknown;
          title?: unknown;
          lastActiveAt?: unknown;
          loaded?: unknown;
          kind?: unknown;
          threadId?: unknown;
        };
        if (!tab.id || !tab.title) {
          return null;
        }
        const kind =
          tab.kind === "workspace"
            ? "workspace"
            : tab.kind === "debug-log" || tab.id === DEBUG_LOG_TAB_ID
              ? "debug-log"
              : tab.kind === "nanobot-log" || tab.id === NANOBOT_LOG_TAB_ID
                ? "nanobot-log"
                : tab.kind === "home" || tab.id === HOME_TAB_ID
                  ? "home"
                  : "thread";
        if (
          kind !== "home" &&
          kind !== "debug-log" &&
          kind !== "nanobot-log" &&
          !tab.workspaceId
        ) {
          return null;
        }
        if (kind === "thread" && !tab.threadId) {
          return null;
        }
        return {
          id: String(tab.id),
          workspaceId:
            kind === "home"
              ? HOME_TAB_WORKSPACE_ID
              : kind === "debug-log" || kind === "nanobot-log"
                ? SYSTEM_TAB_WORKSPACE_ID
              : String(tab.workspaceId),
          title: String(tab.title),
          lastActiveAt:
            typeof tab.lastActiveAt === "number" ? tab.lastActiveAt : Date.now(),
          loaded: Boolean(tab.loaded),
          kind,
          ...(kind === "thread" ? { threadId: String(tab.threadId) } : {}),
        };
      })
      .filter(Boolean) as ThreadTab[];
  } catch {
    return [];
  }
};

const loadStoredTabs = () => {
  if (typeof window === "undefined") {
    return [];
  }
  return parseStoredTabs(window.localStorage.getItem(TABS_STORAGE_KEY));
};

const loadStoredActiveTab = () => {
  if (typeof window === "undefined") {
    return null;
  }
  const value = window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
  return value ? value : null;
};

const makeTabId = (workspaceId: string, threadId: string) =>
  `${workspaceId}:${threadId}`;
const makeWorkspaceTabId = (workspaceId: string) => `${workspaceId}:workspace-home`;
const SYSTEM_TAB_WORKSPACE_ID = "__system__";
const DEBUG_LOG_TAB_ID = `${SYSTEM_TAB_WORKSPACE_ID}:debug-log`;
const NANOBOT_LOG_TAB_ID = `${SYSTEM_TAB_WORKSPACE_ID}:nanobot-log`;
const HOME_TAB_WORKSPACE_ID = "__home__";
const HOME_TAB_ID = `${HOME_TAB_WORKSPACE_ID}:home`;

export function useThreadTabs({
  workspaces,
  threadsByWorkspace,
  homeTabTitle,
  debugLogTabTitle,
  nanobotLogTabTitle,
}: UseThreadTabsOptions) {
  const [tabs, setTabs] = useState<ThreadTab[]>(() => loadStoredTabs());
  const [activeTabId, setActiveTabId] = useState<string | null>(() =>
    loadStoredActiveTab(),
  );

  const workspaceIds = useMemo(
    () => new Set(workspaces.map((workspace) => workspace.id)),
    [workspaces],
  );
  const workspaceNameLookup = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace.name])),
    [workspaces],
  );

  const threadNameLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    Object.entries(threadsByWorkspace).forEach(([workspaceId, threads]) => {
      threads.forEach((thread) => {
        lookup.set(makeTabId(workspaceId, thread.id), thread.name);
      });
    });
    return lookup;
  }, [threadsByWorkspace]);

  useEffect(() => {
    setTabs((prev) =>
      prev
        .filter(
          (tab) =>
            tab.kind === "home" ||
            tab.kind === "debug-log" ||
            tab.kind === "nanobot-log" ||
            workspaceIds.has(tab.workspaceId),
        )
        .map((tab) => {
          const nextTitle =
            tab.kind === "thread"
              ? threadNameLookup.get(makeTabId(tab.workspaceId, tab.threadId))
              : tab.kind === "workspace"
                ? workspaceNameLookup.get(tab.workspaceId)
                : tab.kind === "debug-log"
                  ? debugLogTabTitle
                  : tab.kind === "nanobot-log"
                    ? nanobotLogTabTitle
                    : homeTabTitle;
          if (nextTitle && nextTitle !== tab.title) {
            return { ...tab, title: nextTitle };
          }
          return tab;
        }),
    );
  }, [
    debugLogTabTitle,
    homeTabTitle,
    nanobotLogTabTitle,
    threadNameLookup,
    workspaceIds,
    workspaceNameLookup,
  ]);

  useEffect(() => {
    if (!tabs.length) {
      if (activeTabId !== null) {
        setActiveTabId(null);
      }
      return;
    }
    if (!activeTabId || !tabs.some((tab) => tab.id === activeTabId)) {
      setActiveTabId(tabs[0]?.id ?? null);
    }
  }, [activeTabId, tabs]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(tabs));
  }, [tabs]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (activeTabId) {
      window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTabId);
    } else {
      window.localStorage.removeItem(ACTIVE_TAB_STORAGE_KEY);
    }
  }, [activeTabId]);

  const openTab = useCallback(
    (workspaceId: string, threadId: string, title: string) => {
      const id = makeTabId(workspaceId, threadId);
      setTabs((prev) => {
        const existing = prev.find((tab) => tab.id === id);
        if (existing) {
          return prev.map((tab) =>
            tab.id === id
              ? { ...tab, title, lastActiveAt: Date.now() }
              : tab,
          );
        }
        return [
          ...prev,
          {
            id,
            kind: "thread",
            workspaceId,
            threadId,
            title,
            lastActiveAt: Date.now(),
            loaded: false,
          },
        ];
      });
      setActiveTabId(id);
    },
    [],
  );

  const openWorkspaceTab = useCallback((workspaceId: string, title: string) => {
    const id = makeWorkspaceTabId(workspaceId);
    setTabs((prev) => {
      const existing = prev.find((tab) => tab.id === id);
      if (existing) {
        return prev.map((tab) =>
          tab.id === id
            ? { ...tab, title, lastActiveAt: Date.now() }
            : tab,
        );
      }
      return [
        ...prev,
        {
          id,
          kind: "workspace",
          workspaceId,
          title,
          lastActiveAt: Date.now(),
          loaded: false,
        },
      ];
    });
    setActiveTabId(id);
  }, []);

  const openHomeTab = useCallback((title: string) => {
    setTabs((prev) => {
      const existing = prev.find((tab) => tab.id === HOME_TAB_ID);
      if (existing) {
        return prev.map((tab) =>
          tab.id === HOME_TAB_ID
            ? { ...tab, title, lastActiveAt: Date.now() }
            : tab,
        );
      }
      return [
        ...prev,
        {
          id: HOME_TAB_ID,
          kind: "home",
          workspaceId: HOME_TAB_WORKSPACE_ID,
          title,
          lastActiveAt: Date.now(),
          loaded: true,
        },
      ];
    });
    setActiveTabId(HOME_TAB_ID);
  }, []);

  const openDebugLogTab = useCallback((title: string) => {
    setTabs((prev) => {
      const existing = prev.find((tab) => tab.id === DEBUG_LOG_TAB_ID);
      if (existing) {
        return prev.map((tab) =>
          tab.id === DEBUG_LOG_TAB_ID
            ? { ...tab, title, lastActiveAt: Date.now(), loaded: true }
            : tab,
        );
      }
      return [
        ...prev,
        {
          id: DEBUG_LOG_TAB_ID,
          kind: "debug-log",
          workspaceId: SYSTEM_TAB_WORKSPACE_ID,
          title,
          lastActiveAt: Date.now(),
          loaded: true,
        },
      ];
    });
    setActiveTabId(DEBUG_LOG_TAB_ID);
  }, []);

  const openNanobotLogTab = useCallback((title: string) => {
    setTabs((prev) => {
      const existing = prev.find((tab) => tab.id === NANOBOT_LOG_TAB_ID);
      if (existing) {
        return prev.map((tab) =>
          tab.id === NANOBOT_LOG_TAB_ID
            ? { ...tab, title, lastActiveAt: Date.now(), loaded: true }
            : tab,
        );
      }
      return [
        ...prev,
        {
          id: NANOBOT_LOG_TAB_ID,
          kind: "nanobot-log",
          workspaceId: SYSTEM_TAB_WORKSPACE_ID,
          title,
          lastActiveAt: Date.now(),
          loaded: true,
        },
      ];
    });
    setActiveTabId(NANOBOT_LOG_TAB_ID);
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const currentIndex = prev.findIndex((tab) => tab.id === tabId);
      if (currentIndex === -1) {
        return prev;
      }
      const nextTabs = prev.filter((tab) => tab.id !== tabId);
      setActiveTabId((currentActive) => {
        if (!currentActive || currentActive !== tabId) {
          return currentActive;
        }
        const leftTab = prev
          .slice(0, currentIndex)
          .reverse()
          .find((tab) => tab.id !== tabId);
        const rightTab = prev.slice(currentIndex + 1).find((tab) => tab.id !== tabId);
        return leftTab?.id ?? rightTab?.id ?? null;
      });
      return nextTabs;
    });
  }, []);

  const closeTabs = useCallback((tabIds: string[]) => {
    if (tabIds.length === 0) {
      return;
    }
    const closeSet = new Set(tabIds);
    setTabs((prev) => {
      if (!prev.some((tab) => closeSet.has(tab.id))) {
        return prev;
      }
      const nextTabs = prev.filter((tab) => !closeSet.has(tab.id));
      setActiveTabId((currentActive) => {
        if (!currentActive || !closeSet.has(currentActive)) {
          return currentActive;
        }
        const currentIndex = prev.findIndex((tab) => tab.id === currentActive);
        const leftTab = prev
          .slice(0, currentIndex)
          .reverse()
          .find((tab) => !closeSet.has(tab.id));
        const rightTab = prev
          .slice(currentIndex + 1)
          .find((tab) => !closeSet.has(tab.id));
        return leftTab?.id ?? rightTab?.id ?? null;
      });
      return nextTabs;
    });
  }, []);

  const setActiveTab = useCallback((tabId: string | null) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabId
          ? { ...tab, lastActiveAt: Date.now() }
          : tab,
      ),
    );
    setActiveTabId(tabId);
  }, []);

  const markTabLoaded = useCallback((tabId: string) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabId ? { ...tab, loaded: true } : tab,
      ),
    );
  }, []);

  const reorderTabs = useCallback((tabId: string, targetId: string) => {
    if (tabId === targetId) {
      return;
    }
    setTabs((prev) => {
      const fromIndex = prev.findIndex((tab) => tab.id === tabId);
      const toIndex = prev.findIndex((tab) => tab.id === targetId);
      if (fromIndex === -1 || toIndex === -1) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  return {
    tabs,
    activeTabId,
    setActiveTab,
    openTab,
    openWorkspaceTab,
    openHomeTab,
    openDebugLogTab,
    openNanobotLogTab,
    closeTab,
    closeTabs,
    markTabLoaded,
    reorderTabs,
  };
}
