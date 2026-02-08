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
);

type UseThreadTabsOptions = {
  workspaces: WorkspaceInfo[];
  threadsByWorkspace: Record<string, ThreadSummary[]>;
  homeTabTitle: string;
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
            : tab.kind === "home" || tab.id === HOME_TAB_ID
              ? "home"
              : "thread";
        if (kind !== "home" && !tab.workspaceId) {
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
const HOME_TAB_WORKSPACE_ID = "__home__";
const HOME_TAB_ID = `${HOME_TAB_WORKSPACE_ID}:home`;

export function useThreadTabs({
  workspaces,
  threadsByWorkspace,
  homeTabTitle,
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
        .filter((tab) => tab.kind === "home" || workspaceIds.has(tab.workspaceId))
        .map((tab) => {
          const nextTitle =
            tab.kind === "thread"
              ? threadNameLookup.get(makeTabId(tab.workspaceId, tab.threadId))
              : tab.kind === "workspace"
                ? workspaceNameLookup.get(tab.workspaceId)
                : homeTabTitle;
          if (nextTitle && nextTitle !== tab.title) {
            return { ...tab, title: nextTitle };
          }
          return tab;
        }),
    );
  }, [homeTabTitle, threadNameLookup, workspaceIds, workspaceNameLookup]);

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

  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((tab) => tab.id === tabId);
      if (idx === -1) {
        return prev;
      }
      const nextTabs = prev.filter((tab) => tab.id !== tabId);
      if (activeTabId === tabId) {
        const nextTab = nextTabs[idx - 1] ?? nextTabs[idx] ?? null;
        setActiveTabId(nextTab?.id ?? null);
      }
      return nextTabs;
    });
  }, [activeTabId]);

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
    closeTab,
    markTabLoaded,
    reorderTabs,
  };
}
