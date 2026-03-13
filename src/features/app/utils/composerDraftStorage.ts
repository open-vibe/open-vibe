export const STORAGE_KEY_COMPOSER_DRAFTS = "codexmonitor.composerDrafts";

export type ComposerDraftEntry = {
  text: string;
  images: string[];
};

export type ComposerDraftMap = Record<string, ComposerDraftEntry>;

const EMPTY_DRAFT: ComposerDraftEntry = { text: "", images: [] };

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function normalizeDraftEntry(value: unknown): ComposerDraftEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const text = typeof record.text === "string" ? record.text : "";
  const images = isStringArray(record.images) ? record.images.filter(Boolean) : [];
  if (!text && images.length === 0) {
    return null;
  }
  return {
    text,
    images: Array.from(new Set(images)),
  };
}

export function makeComposerDraftKey(
  workspaceId: string | null,
  threadId: string | null,
): string | null {
  if (workspaceId && threadId) {
    return `thread:${workspaceId}:${threadId}`;
  }
  if (workspaceId) {
    return `workspace:${workspaceId}`;
  }
  return null;
}

export function loadComposerDrafts(): ComposerDraftMap {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_COMPOSER_DRAFTS);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const next: ComposerDraftMap = {};
    Object.entries(parsed).forEach(([key, value]) => {
      const entry = normalizeDraftEntry(value);
      if (entry) {
        next[key] = entry;
      }
    });
    return next;
  } catch {
    return {};
  }
}

export function saveComposerDrafts(drafts: ComposerDraftMap) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (Object.keys(drafts).length === 0) {
      window.localStorage.removeItem(STORAGE_KEY_COMPOSER_DRAFTS);
      return;
    }
    window.localStorage.setItem(
      STORAGE_KEY_COMPOSER_DRAFTS,
      JSON.stringify(drafts),
    );
  } catch {
    // Best-effort persistence; ignore quota and serialization failures.
  }
}

export function getEmptyComposerDraft(): ComposerDraftEntry {
  return EMPTY_DRAFT;
}
