import { useCallback } from "react";
import type { HappyBridgeEvent } from "../../../types";
import { useTauriEvent } from "../../app/hooks/useTauriEvent";
import { subscribeHappyBridgeEvents } from "../../../services/events";

type UseHappyBridgeSyncOptions = {
  enabled: boolean;
  onStatus?: (connected: boolean, reason?: string) => void;
  onMessageSync?: (event: Extract<HappyBridgeEvent, { type: "message-sync" }>) => void;
};

export function useHappyBridgeSync({
  enabled,
  onStatus,
  onMessageSync,
}: UseHappyBridgeSyncOptions) {
  const handleEvent = useCallback(
    (event: HappyBridgeEvent) => {
      if (!enabled) {
        return;
      }
      if (event.type === "status") {
        onStatus?.(event.connected, event.reason);
        return;
      }
      if (event.type === "message-sync") {
        onMessageSync?.(event);
      }
    },
    [enabled, onMessageSync, onStatus],
  );

  useTauriEvent(subscribeHappyBridgeEvents, handleEvent, { enabled });
}
