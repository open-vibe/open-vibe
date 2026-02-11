import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppSettings, DebugEntry, NanobotBridgeEvent, ThreadSummary, WorkspaceInfo } from "../../../types";
import {
  probeNanobotBluetooth,
  sendNanobotBridgeCommand,
} from "../../../services/tauri";
import { subscribeNanobotBridgeEvents } from "../../../services/events";
import { useTauriEvent } from "../../app/hooks/useTauriEvent";
import type { TranslationKey, TranslationParams } from "../../../i18n";

type NanobotBridgeTranslator = (
  key: TranslationKey,
  params?: TranslationParams,
) => string;

type ThreadActivityStatus = {
  isProcessing: boolean;
};

type UseNanobotAwayNotifyOptions = {
  appSettings: AppSettings;
  nanobotStatus: {
    enabled: boolean;
    dingtalkEnabled: boolean;
    emailEnabled: boolean;
    qqEnabled: boolean;
    connected: boolean;
    running: boolean;
    configured: boolean;
  };
  threadStatusById: Record<string, ThreadActivityStatus>;
  threadsByWorkspace: Record<string, ThreadSummary[]>;
  workspaces: WorkspaceInfo[];
  t: NanobotBridgeTranslator;
  onDebug?: (entry: DebugEntry) => void;
};

type LastRoute = {
  channel: string;
  chatId: string;
  updatedAt: number;
};

type BluetoothState = {
  devices: Array<{
    id: string;
    name: string;
    rssi?: number | null;
  }>;
  supported: boolean;
  scanning: boolean;
  nearby: boolean | null;
  error: string | null;
  lastSeenAt: number | null;
};

function stringifyError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function useNanobotAwayNotify({
  appSettings,
  nanobotStatus,
  threadStatusById,
  threadsByWorkspace,
  workspaces,
  t,
  onDebug,
}: UseNanobotAwayNotifyOptions) {
  const [windowAway, setWindowAway] = useState(false);
  const [bluetoothState, setBluetoothState] = useState<BluetoothState>({
    devices: [],
    supported: false,
    scanning: false,
    nearby: null,
    error: null,
    lastSeenAt: null,
  });
  const lastRouteRef = useRef<LastRoute | null>(null);
  const lastInteractionAtRef = useRef<number>(Date.now());
  const bluetoothTimerRef = useRef<number | null>(null);
  const bluetoothPollingRef = useRef(false);
  const lastNotifyAtRef = useRef<number>(0);
  const previousProcessingRef = useRef<Map<string, boolean>>(new Map());
  const bluetoothKeywordRef = useRef(appSettings.nanobotAwayBluetoothKeyword.trim().toLowerCase());

  bluetoothKeywordRef.current = appSettings.nanobotAwayBluetoothKeyword.trim().toLowerCase();

  const hasNanobotChannel =
    nanobotStatus.dingtalkEnabled || nanobotStatus.emailEnabled || nanobotStatus.qqEnabled;

  const pollBluetoothPresence = useCallback(async () => {
    if (bluetoothPollingRef.current) {
      return;
    }
    bluetoothPollingRef.current = true;
    try {
      const result = await probeNanobotBluetooth(bluetoothKeywordRef.current, 2200);
      const now = Date.now();
      const nextError = result.error?.trim() ?? "";
      const selectedDeviceId = appSettings.nanobotAwayBluetoothDeviceId.trim();
      const keyword = bluetoothKeywordRef.current;
      const devices = Array.isArray(result.devices) ? result.devices : [];
      const nearby = selectedDeviceId
        ? devices.some((item) => item.id === selectedDeviceId)
        : keyword
          ? devices.some((item) => item.name.toLowerCase().includes(keyword))
          : null;
      setBluetoothState((prev) => ({
        ...prev,
        devices,
        supported: result.supported,
        nearby,
        lastSeenAt: nearby ? now : prev.lastSeenAt,
        error:
          nextError ||
          (result.supported ? null : t("settings.nanobot.away.bluetooth.unsupported")),
      }));
      if (!result.supported) {
        onDebug?.({
          id: `${now}-nanobot-bluetooth-unsupported`,
          timestamp: now,
          source: "event",
          label: "nanobot/bluetooth-unsupported",
          payload: {
            keyword: bluetoothKeywordRef.current,
            devices: devices.length,
            error: result.error ?? null,
          },
        });
      }
    } catch (error) {
      setBluetoothState((prev) => ({
        ...prev,
        supported: false,
        nearby: null,
        error: stringifyError(error) || t("settings.nanobot.away.bluetooth.unavailable"),
      }));
    } finally {
      bluetoothPollingRef.current = false;
    }
  }, [appSettings.nanobotAwayBluetoothDeviceId, onDebug, t]);

  const stopBluetoothScan = useCallback(() => {
    if (bluetoothTimerRef.current !== null) {
      window.clearInterval(bluetoothTimerRef.current);
      bluetoothTimerRef.current = null;
    }
    setBluetoothState((prev) => ({
      ...prev,
      scanning: false,
    }));
  }, []);

  const startBluetoothScan = useCallback(async () => {
    if (bluetoothTimerRef.current !== null) {
      return;
    }
    setBluetoothState((prev) => ({
      ...prev,
      scanning: true,
      error: null,
    }));
    await pollBluetoothPresence();
    bluetoothTimerRef.current = window.setInterval(() => {
      void pollBluetoothPresence();
    }, 8000);
  }, [pollBluetoothPresence]);

  useEffect(() => {
    const onActivity = () => {
      lastInteractionAtRef.current = Date.now();
      setWindowAway(false);
    };
    const events: Array<keyof WindowEventMap> = [
      "focus",
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];
    events.forEach((eventName) => {
      window.addEventListener(eventName, onActivity, { passive: true });
    });
    document.addEventListener("visibilitychange", onActivity);
    const timer = window.setInterval(() => {
      const now = Date.now();
      const idleMs = Math.max(15, appSettings.nanobotAwayIdleSeconds) * 1000;
      const isIdle = now - lastInteractionAtRef.current >= idleMs;
      const isHidden = document.visibilityState === "hidden";
      const isBlurred = !document.hasFocus();
      setWindowAway(isIdle || isHidden || isBlurred);
    }, 3_000);
    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, onActivity);
      });
      document.removeEventListener("visibilitychange", onActivity);
      window.clearInterval(timer);
    };
  }, [appSettings.nanobotAwayIdleSeconds]);

  useEffect(() => {
    if (!appSettings.nanobotAwayBluetoothEnabled || !appSettings.nanobotAwayNotifyEnabled) {
      stopBluetoothScan();
      setBluetoothState((prev) => ({
        ...prev,
        scanning: false,
        nearby: null,
        devices: [],
        error: null,
      }));
      return;
    }
    if (bluetoothTimerRef.current !== null) {
      return;
    }
    void startBluetoothScan();
  }, [
    appSettings.nanobotAwayBluetoothEnabled,
    appSettings.nanobotAwayNotifyEnabled,
    startBluetoothScan,
    stopBluetoothScan,
  ]);

  useEffect(() => {
    return () => {
      stopBluetoothScan();
    };
  }, [stopBluetoothScan]);

  useTauriEvent(
    subscribeNanobotBridgeEvents,
    useCallback((event: NanobotBridgeEvent) => {
      if (event.type !== "remote-message") {
        return;
      }
      lastRouteRef.current = {
        channel: event.channel,
        chatId: event.chatId,
        updatedAt: Date.now(),
      };
    }, []),
    { enabled: true },
  );

  const threadLookup = useMemo(() => {
    const lookup = new Map<string, { threadName: string; workspaceName: string }>();
    Object.entries(threadsByWorkspace).forEach(([workspaceId, threads]) => {
      const workspaceName =
        workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? workspaceId;
      threads.forEach((thread) => {
        lookup.set(thread.id, {
          threadName: thread.name,
          workspaceName,
        });
      });
    });
    return lookup;
  }, [threadsByWorkspace, workspaces]);

  // Treat Bluetooth as an extra signal while unfocused/idle; avoid forcing "away"
  // when the user is actively using the app but BLE name matching misses.
  const isAway = appSettings.nanobotAwayBluetoothEnabled
    ? windowAway && bluetoothState.nearby !== true
    : windowAway;

  useEffect(() => {
    const completedThreadIds: string[] = [];
    const nextMap = new Map<string, boolean>();
    Object.entries(threadStatusById).forEach(([threadId, status]) => {
      const isProcessing = Boolean(status?.isProcessing);
      const wasProcessing = previousProcessingRef.current.get(threadId) ?? false;
      if (wasProcessing && !isProcessing) {
        completedThreadIds.push(threadId);
      }
      nextMap.set(threadId, isProcessing);
    });
    previousProcessingRef.current = nextMap;
    if (!completedThreadIds.length) {
      return;
    }
    if (
      !appSettings.nanobotAwayNotifyEnabled ||
      !nanobotStatus.enabled ||
      !nanobotStatus.connected ||
      !hasNanobotChannel ||
      !isAway
    ) {
      return;
    }
    const route = lastRouteRef.current;
    if (!route) {
      return;
    }
    const now = Date.now();
    const cooldownMs = Math.max(15, appSettings.nanobotAwayCooldownSeconds) * 1000;
    if (now - lastNotifyAtRef.current < cooldownMs) {
      return;
    }
    const latestThreadId = completedThreadIds[completedThreadIds.length - 1];
    const latest = threadLookup.get(latestThreadId);
    const fallbackName = latestThreadId.slice(0, 8);
    const content =
      completedThreadIds.length > 1
        ? t("nanobot.awayNotify.message.multi", {
            count: completedThreadIds.length,
            name: latest?.threadName ?? fallbackName,
            workspace: latest?.workspaceName ?? "",
          })
        : t("nanobot.awayNotify.message.single", {
            name: latest?.threadName ?? fallbackName,
            workspace: latest?.workspaceName ?? "",
          });
    void sendNanobotBridgeCommand({
      type: "direct-message",
      channel: route.channel,
      chatId: route.chatId,
      content,
    })
      .then(() => {
        lastNotifyAtRef.current = now;
        onDebug?.({
          id: `${now}-nanobot-away-notify`,
          timestamp: now,
          source: "event",
          label: "nanobot/away-notify",
          payload: {
            threadIds: completedThreadIds,
            route,
          },
        });
      })
      .catch((error: unknown) => {
        onDebug?.({
          id: `${Date.now()}-nanobot-away-notify-error`,
          timestamp: Date.now(),
          source: "error",
          label: "nanobot/away-notify-error",
          payload: stringifyError(error),
        });
      });
  }, [
    appSettings.nanobotAwayCooldownSeconds,
    appSettings.nanobotAwayNotifyEnabled,
    hasNanobotChannel,
    isAway,
    nanobotStatus.connected,
    nanobotStatus.enabled,
    onDebug,
    t,
    threadLookup,
    threadStatusById,
  ]);

  return {
    isAway,
    bluetooth: bluetoothState,
    bluetoothDevices: bluetoothState.devices,
    startBluetoothScan,
    stopBluetoothScan,
  };
}
