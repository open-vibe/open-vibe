import { useCallback, useState } from "react";
import type { QueuedMessage, WorkspaceInfo } from "../../../types";
import { useQueuedSend } from "../../threads/hooks/useQueuedSend";
import { useComposerDraftStore } from "./useComposerDraftStore";

export function useComposerController({
  activeThreadId,
  activeWorkspaceId,
  activeWorkspace,
  isProcessing,
  isReviewing,
  steerEnabled,
  connectWorkspace,
  sendUserMessage,
  startReview,
}: {
  activeThreadId: string | null;
  activeWorkspaceId: string | null;
  activeWorkspace: WorkspaceInfo | null;
  isProcessing: boolean;
  isReviewing: boolean;
  steerEnabled: boolean;
  connectWorkspace: (workspace: WorkspaceInfo) => Promise<void>;
  sendUserMessage: (text: string, images?: string[]) => Promise<void>;
  startReview: (text: string) => Promise<void>;
}) {
  const [prefillDraft, setPrefillDraft] = useState<QueuedMessage | null>(null);
  const [composerInsert, setComposerInsert] = useState<QueuedMessage | null>(
    null,
  );

  const {
    activeDraft,
    activeImages,
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
  } = useComposerDraftStore({ activeThreadId, activeWorkspaceId });

  const {
    activeQueue,
    handleSend,
    queueMessage,
    removeQueuedMessage,
  } = useQueuedSend({
    activeThreadId,
    isProcessing,
    isReviewing,
    steerEnabled,
    activeWorkspace,
    connectWorkspace,
    sendUserMessage,
    startReview,
    clearActiveImages,
  });

  const handleSendPrompt = useCallback(
    (text: string) => {
      if (!text.trim()) {
        return;
      }
      void handleSend(text, []);
    },
    [handleSend],
  );

  const handleEditQueued = useCallback(
    (item: QueuedMessage) => {
      if (!activeThreadId || !activeWorkspaceId) {
        return;
      }
      removeQueuedMessage(activeThreadId, item.id);
      setImagesForThread(activeWorkspaceId, activeThreadId, item.images ?? []);
      setPrefillDraft(item);
    },
    [activeThreadId, activeWorkspaceId, removeQueuedMessage, setImagesForThread],
  );

  const handleDeleteQueued = useCallback(
    (id: string) => {
      if (!activeThreadId) {
        return;
      }
      removeQueuedMessage(activeThreadId, id);
    },
    [activeThreadId, removeQueuedMessage],
  );

  return {
    activeImages,
    attachImages,
    pickImages,
    removeImage,
    clearActiveImages,
    setImagesForThread,
    removeImagesForThread,
    getImagesForThread,
    activeQueue,
    handleSend,
    queueMessage,
    removeQueuedMessage,
    prefillDraft,
    setPrefillDraft,
    composerInsert,
    setComposerInsert,
    activeDraft,
    handleDraftChange,
    handleSendPrompt,
    handleEditQueued,
    handleDeleteQueued,
    clearDraftForThread,
    getDraftForThread,
  };
}
