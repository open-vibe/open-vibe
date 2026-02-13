import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emitTo } from "@tauri-apps/api/event";
import type { ThreadTab } from "../hooks/useThreadTabs";

export const DETACHED_TAB_QUERY_KEY = "detachedTab";
export const DETACHED_TAB_CLOSED_EVENT = "openvibe/detached-tab-closed";

export type DetachedTabPayload = {
  id: string;
  kind: ThreadTab["kind"];
  workspaceId: string;
  title: string;
  threadId?: string;
};

export type DetachedTabClosedPayload = {
  tabId: string;
};

const sanitizeWindowLabel = (value: string) =>
  value.replace(/[^a-zA-Z0-9_:/-]/g, "_");

export const toDetachedTabPayload = (tab: ThreadTab): DetachedTabPayload => ({
  id: tab.id,
  kind: tab.kind,
  workspaceId: tab.workspaceId,
  title: tab.title,
  ...(tab.kind === "thread" ? { threadId: tab.threadId } : {}),
});

export const parseDetachedTabFromSearch = (
  search: string,
): DetachedTabPayload | null => {
  try {
    const params = new URLSearchParams(search);
    const raw = params.get(DETACHED_TAB_QUERY_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as DetachedTabPayload;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (
      !parsed.id ||
      !parsed.kind ||
      !parsed.workspaceId ||
      !parsed.title ||
      (parsed.kind === "thread" && !parsed.threadId)
    ) {
      return null;
    }
    if (
      parsed.kind !== "thread" &&
      parsed.kind !== "workspace" &&
      parsed.kind !== "home" &&
      parsed.kind !== "debug-log" &&
      parsed.kind !== "nanobot-log"
    ) {
      return null;
    }
    return {
      id: String(parsed.id),
      kind: parsed.kind,
      workspaceId: String(parsed.workspaceId),
      title: String(parsed.title),
      ...(parsed.threadId ? { threadId: String(parsed.threadId) } : {}),
    };
  } catch {
    return null;
  }
};

export const openDetachedTabWindow = async (
  payload: DetachedTabPayload,
): Promise<string> => {
  if (payload.kind === "thread" && !payload.threadId) {
    throw new Error("Thread tab is missing thread id");
  }
  if (typeof window === "undefined") {
    throw new Error("Window API unavailable");
  }
  const url = new URL(window.location.href);
  url.searchParams.set(DETACHED_TAB_QUERY_KEY, JSON.stringify(payload));
  const label = sanitizeWindowLabel(`detached-tab-${payload.id}-${Date.now()}`);
  const detachedWindow = new WebviewWindow(label, {
    title: payload.title,
    url: url.toString(),
    width: 1320,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    center: true,
  });
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    void detachedWindow.once("tauri://created", () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    });
    void detachedWindow.once("tauri://error", (event) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error(String(event.payload ?? "failed to open detached tab")));
    });
  });
  return label;
};

export const notifyMainDetachedTabClosed = async (
  payload: DetachedTabClosedPayload,
): Promise<void> => {
  await emitTo("main", DETACHED_TAB_CLOSED_EVENT, payload);
};
