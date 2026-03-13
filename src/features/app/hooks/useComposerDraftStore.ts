import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pickImageFiles } from "../../../services/tauri";
import {
  getEmptyComposerDraft,
  loadComposerDrafts,
  makeComposerDraftKey,
  saveComposerDrafts,
  STORAGE_KEY_COMPOSER_DRAFTS,
  type ComposerDraftEntry,
  type ComposerDraftMap,
} from "../utils/composerDraftStorage";

type UseComposerDraftStoreArgs = {
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
};

const DRAFT_PERSIST_DELAY_MS = 150;

function normalizeImages(images: string[]) {
  return Array.from(new Set(images.filter(Boolean)));
}

function areStringArraysEqual(a: string[], b: string[]) {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }
  return true;
}

function areDraftEntriesEqual(a: ComposerDraftEntry, b: ComposerDraftEntry) {
  return a.text === b.text && areStringArraysEqual(a.images, b.images);
}

function normalizeDraftEntry(entry: ComposerDraftEntry): ComposerDraftEntry | null {
  const text = entry.text;
  const images = normalizeImages(entry.images);
  if (!text && images.length === 0) {
    return null;
  }
  return { text, images };
}

export function useComposerDraftStore({
  activeWorkspaceId,
  activeThreadId,
}: UseComposerDraftStoreArgs) {
  const [draftsByKey, setDraftsByKey] = useState<ComposerDraftMap>(() =>
    loadComposerDrafts(),
  );
  const draftsByKeyRef = useRef(draftsByKey);
  const activeDraftKey = useMemo(
    () => makeComposerDraftKey(activeWorkspaceId, activeThreadId),
    [activeThreadId, activeWorkspaceId],
  );

  useEffect(() => {
    draftsByKeyRef.current = draftsByKey;
  }, [draftsByKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      saveComposerDrafts(draftsByKeyRef.current);
    }, DRAFT_PERSIST_DELAY_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [draftsByKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const flush = () => {
      saveComposerDrafts(draftsByKeyRef.current);
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY_COMPOSER_DRAFTS) {
        return;
      }
      setDraftsByKey(loadComposerDrafts());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const updateDraftForKey = useCallback(
    (
      key: string | null,
      updater: (entry: ComposerDraftEntry) => ComposerDraftEntry,
    ) => {
      if (!key) {
        return;
      }
      setDraftsByKey((prev) => {
        const current = prev[key] ?? getEmptyComposerDraft();
        const next = normalizeDraftEntry(updater(current));
        if (!next) {
          if (!(key in prev)) {
            return prev;
          }
          const { [key]: _removed, ...rest } = prev;
          return rest;
        }
        if (areDraftEntriesEqual(current, next)) {
          return prev;
        }
        return { ...prev, [key]: next };
      });
    },
    [],
  );

  const activeDraftEntry = activeDraftKey
    ? draftsByKey[activeDraftKey] ?? getEmptyComposerDraft()
    : getEmptyComposerDraft();

  const handleDraftChange = useCallback(
    (next: string, _options?: { immediate?: boolean }) => {
      updateDraftForKey(activeDraftKey, (entry) => ({
        ...entry,
        text: next,
      }));
    },
    [activeDraftKey, updateDraftForKey],
  );

  const attachImages = useCallback(
    (paths: string[]) => {
      if (paths.length === 0) {
        return;
      }
      updateDraftForKey(activeDraftKey, (entry) => ({
        ...entry,
        images: normalizeImages([...entry.images, ...paths]),
      }));
    },
    [activeDraftKey, updateDraftForKey],
  );

  const pickImages = useCallback(async () => {
    const picked = await pickImageFiles();
    if (picked.length === 0) {
      return;
    }
    attachImages(picked);
  }, [attachImages]);

  const removeImage = useCallback(
    (path: string) => {
      updateDraftForKey(activeDraftKey, (entry) => ({
        ...entry,
        images: entry.images.filter((item) => item !== path),
      }));
    },
    [activeDraftKey, updateDraftForKey],
  );

  const clearActiveImages = useCallback(() => {
    updateDraftForKey(activeDraftKey, (entry) => ({
      ...entry,
      images: [],
    }));
  }, [activeDraftKey, updateDraftForKey]);

  const getDraftForThread = useCallback(
    (workspaceId: string, threadId: string) => {
      const key = makeComposerDraftKey(workspaceId, threadId);
      return key ? draftsByKey[key]?.text ?? "" : "";
    },
    [draftsByKey],
  );

  const clearDraftForThread = useCallback((workspaceId: string, threadId: string) => {
    const key = makeComposerDraftKey(workspaceId, threadId);
    if (!key) {
      return;
    }
    setDraftsByKey((prev) => {
      if (!(key in prev)) {
        return prev;
      }
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const getImagesForThread = useCallback(
    (workspaceId: string, threadId: string) => {
      const key = makeComposerDraftKey(workspaceId, threadId);
      return key ? draftsByKey[key]?.images ?? [] : [];
    },
    [draftsByKey],
  );

  const setImagesForThread = useCallback(
    (workspaceId: string, threadId: string, images: string[]) => {
      const key = makeComposerDraftKey(workspaceId, threadId);
      updateDraftForKey(key, (entry) => ({
        ...entry,
        images: normalizeImages(images),
      }));
    },
    [updateDraftForKey],
  );

  const removeImagesForThread = useCallback(
    (workspaceId: string, threadId: string) => {
      const key = makeComposerDraftKey(workspaceId, threadId);
      updateDraftForKey(key, (entry) => ({
        ...entry,
        images: [],
      }));
    },
    [updateDraftForKey],
  );

  return {
    activeDraft: activeDraftEntry.text,
    activeImages: activeDraftEntry.images,
    handleDraftChange,
    attachImages,
    pickImages,
    removeImage,
    clearActiveImages,
    getDraftForThread,
    clearDraftForThread,
    getImagesForThread,
    setImagesForThread,
    removeImagesForThread,
  };
}
