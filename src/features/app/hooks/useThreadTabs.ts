import { useCallback, useEffect, useMemo, useState } from "react";
import type { ThreadSummary, WorkspaceInfo } from "../../../types";

const TABS_STORAGE_KEY = "openvibe.threadTabs";
const ACTIVE_TAB_STORAGE_KEY = "openvibe.activeThreadTabId";

export type ThreadTab = {
  id: string;
  workspaceId: string;
  threadId: string;
  title: string;
  lastActiveAt: number;
  loaded: boolean;
};

type UseThreadTabsOptions = {
  workspaces: WorkspaceInfo[];
  threadsByWorkspace: Record<string, ThreadSummary[]>;
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
        const tab = entry as Partial<ThreadTab>;
        if (!tab.id || !tab.workspaceId || !tab.threadId || !tab.title) {
          return null;
        }
        return {
          id: String(tab.id),
          workspaceId: String(tab.workspaceId),
          threadId: String(tab.threadId),
          title: String(tab.title),
          lastActiveAt:
            typeof tab.lastActiveAt === "number" ? tab.lastActiveAt : Date.now(),
          loaded: Boolean(tab.loaded),
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

export function useThreadTabs({
  workspaces,
  threadsByWorkspace,
}: UseThreadTabsOptions) {
  const [tabs, setTabs] = useState<ThreadTab[]>(() => loadStoredTabs());
  const [activeTabId, setActiveTabId] = useState<string | null>(() =>
    loadStoredActiveTab(),
  );

  const workspaceIds = useMemo(
    () => new Set(workspaces.map((workspace) => workspace.id)),
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
        .filter((tab) => workspaceIds.has(tab.workspaceId))
        .map((tab) => {
          const lookupKey = makeTabId(tab.workspaceId, tab.threadId);
          const nextTitle = threadNameLookup.get(lookupKey);
          if (nextTitle && nextTitle !== tab.title) {
            return { ...tab, title: nextTitle };
          }
          return tab;
        }),
    );
  }, [threadNameLookup, workspaceIds]);

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
    closeTab,
    markTabLoaded,
    reorderTabs,
  };
}
