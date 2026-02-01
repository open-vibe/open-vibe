import { useCallback } from "react";
import type { WorkspaceInfo, HappyBridgeEvent } from "../../../types";
import { useTauriEvent } from "../../app/hooks/useTauriEvent";
import { subscribeHappyBridgeEvents } from "../../../services/events";

type UseHappyBridgeEventsOptions = {
  enabled: boolean;
  workspaces: WorkspaceInfo[];
  getWorkspaceIdForThread: (threadId: string) => string | null;
  sendUserMessageToThread: (
    workspace: WorkspaceInfo,
    threadId: string,
    text: string,
    images?: string[],
    options?: { skipPromptExpansion?: boolean },
  ) => Promise<void>;
};

export function useHappyBridgeEvents({
  enabled,
  workspaces,
  getWorkspaceIdForThread,
  sendUserMessageToThread,
}: UseHappyBridgeEventsOptions) {
  const handleEvent = useCallback(
    (event: HappyBridgeEvent) => {
      if (!enabled) {
        return;
      }
      if (event.type !== "remote-message") {
        return;
      }
      if (event.role !== "user") {
        return;
      }
      const workspaceId = getWorkspaceIdForThread(event.threadId);
      if (!workspaceId) {
        return;
      }
      const workspace = workspaces.find((item) => item.id === workspaceId);
      if (!workspace) {
        return;
      }
      void sendUserMessageToThread(workspace, event.threadId, event.content, [], {
        skipPromptExpansion: true,
      });
    },
    [enabled, getWorkspaceIdForThread, sendUserMessageToThread, workspaces],
  );

  useTauriEvent(subscribeHappyBridgeEvents, handleEvent, { enabled });
}
