export const STORAGE_KEY_THREAD_ACTIVITY = "codexmonitor.threadLastUserActivity";
export const STORAGE_KEY_PINNED_THREADS = "codexmonitor.pinnedThreads";
export const STORAGE_KEY_CUSTOM_NAMES = "codexmonitor.threadCustomNames";
export const STORAGE_KEY_THREAD_SUMMARIES = "codexmonitor.threadSummaries";
export const STORAGE_KEY_RATE_LIMITS = "codexmonitor.rateLimitsByWorkspace";
export const MAX_PINS_SOFT_LIMIT = 5;
const MAX_CACHED_THREADS = 50;

export type ThreadActivityMap = Record<string, Record<string, number>>;
export type PinnedThreadsMap = Record<string, number>;
export type CustomNamesMap = Record<string, string>;
export type ThreadSummariesMap = Record<
  string,
  { id: string; name: string; updatedAt: number }[]
>;
export type RateLimitStorageMap = Record<string, unknown>;

export function loadThreadActivity(): ThreadActivityMap {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_THREAD_ACTIVITY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as ThreadActivityMap;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

export function saveThreadActivity(activity: ThreadActivityMap) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      STORAGE_KEY_THREAD_ACTIVITY,
      JSON.stringify(activity),
    );
  } catch {
    // Best-effort persistence; ignore write failures.
  }
}

export function makeCustomNameKey(workspaceId: string, threadId: string): string {
  return `${workspaceId}:${threadId}`;
}

export function loadCustomNames(): CustomNamesMap {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_CUSTOM_NAMES);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as CustomNamesMap;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

export function saveCustomName(workspaceId: string, threadId: string, name: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const current = loadCustomNames();
    const key = makeCustomNameKey(workspaceId, threadId);
    current[key] = name;
    window.localStorage.setItem(
      STORAGE_KEY_CUSTOM_NAMES,
      JSON.stringify(current),
    );
  } catch {
    // Best-effort persistence.
  }
}

export function removeCustomName(workspaceId: string, threadId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const current = loadCustomNames();
    const key = makeCustomNameKey(workspaceId, threadId);
    if (!(key in current)) {
      return;
    }
    delete current[key];
    window.localStorage.setItem(
      STORAGE_KEY_CUSTOM_NAMES,
      JSON.stringify(current),
    );
  } catch {
    // Best-effort persistence.
  }
}

export function makePinKey(workspaceId: string, threadId: string): string {
  return `${workspaceId}:${threadId}`;
}

export function loadPinnedThreads(): PinnedThreadsMap {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PINNED_THREADS);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as PinnedThreadsMap;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

export function savePinnedThreads(pinned: PinnedThreadsMap) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      STORAGE_KEY_PINNED_THREADS,
      JSON.stringify(pinned),
    );
  } catch {
    // Best-effort persistence; ignore write failures.
  }
}

export function loadRateLimitCache(): RateLimitStorageMap {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_RATE_LIMITS);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as RateLimitStorageMap;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

export function saveRateLimitCache(cache: RateLimitStorageMap) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      STORAGE_KEY_RATE_LIMITS,
      JSON.stringify(cache),
    );
  } catch {
    // Best-effort persistence; ignore write failures.
  }
}

export function loadThreadSummaries(): ThreadSummariesMap {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_THREAD_SUMMARIES);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as ThreadSummariesMap;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

export function loadThreadSummariesForWorkspace(
  workspaceId: string,
): ThreadSummariesMap[string] {
  const summaries = loadThreadSummaries()[workspaceId] ?? [];
  if (!Array.isArray(summaries)) {
    return [];
  }
  return summaries.filter(
    (summary) =>
      summary &&
      typeof summary.id === "string" &&
      typeof summary.name === "string" &&
      typeof summary.updatedAt === "number",
  );
}

export function saveThreadSummariesForWorkspace(
  workspaceId: string,
  summaries: ThreadSummariesMap[string],
) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const current = loadThreadSummaries();
    current[workspaceId] = summaries.slice(0, MAX_CACHED_THREADS);
    window.localStorage.setItem(
      STORAGE_KEY_THREAD_SUMMARIES,
      JSON.stringify(current),
    );
  } catch {
    // Best-effort persistence; ignore write failures.
  }
}
