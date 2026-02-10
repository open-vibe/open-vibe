import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DebugEntry, NanobotBridgeEvent, NanobotMode } from "../../../types";
import { getNanobotBridgeStatus } from "../../../services/tauri";
import { subscribeNanobotBridgeEvents } from "../../../services/events";
import { useTauriEvent } from "../../app/hooks/useTauriEvent";

const MAX_NANOBOT_LOG_ENTRIES = 300;

export type NanobotRuntimeSnapshot = {
  enabled: boolean;
  mode: NanobotMode;
  dingtalkEnabled: boolean;
  emailEnabled: boolean;
  qqEnabled: boolean;
  running: boolean;
  configured: boolean;
  connected: boolean;
  reason: string | null;
  lastEventAt: number | null;
};

type UseNanobotMonitorOptions = {
  enabled: boolean;
  mode: NanobotMode;
  dingtalkEnabled: boolean;
  emailEnabled: boolean;
  qqEnabled: boolean;
};

function stringifyError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function useNanobotMonitor({
  enabled,
  mode,
  dingtalkEnabled,
  emailEnabled,
  qqEnabled,
}: UseNanobotMonitorOptions) {
  const [running, setRunning] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [connected, setConnected] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const [logEntries, setLogEntries] = useState<DebugEntry[]>([]);
  const lastStatusKeyRef = useRef<string | null>(null);

  const appendLog = useCallback(
    (
      source: DebugEntry["source"],
      label: string,
      payload?: unknown,
      timestamp: number = Date.now(),
    ) => {
      const entry: DebugEntry = {
        id: `nanobot-${timestamp}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp,
        source,
        label,
        payload,
      };
      setLogEntries((previous) => [...previous, entry].slice(-MAX_NANOBOT_LOG_ENTRIES));
    },
    [],
  );

  const refreshStatus = useCallback(async () => {
    try {
      const status = await getNanobotBridgeStatus();
      setRunning(status.running);
      setConfigured(status.configured);
      if (!status.running || !status.configured) {
        setConnected(false);
      } else if (enabled) {
        // Status events can be missed during startup; treat a healthy daemon as connected.
        setConnected(true);
      }
      if (!enabled) {
        setConnected(false);
        setReason(null);
      }
      const key = `${status.running}:${status.configured}:${status.mode}`;
      if (lastStatusKeyRef.current !== key) {
        lastStatusKeyRef.current = key;
        appendLog("client", "nanobot/status", status);
      }
    } catch (error) {
      appendLog("error", "nanobot/status-error", stringifyError(error));
    }
  }, [appendLog, enabled]);

  useEffect(() => {
    void refreshStatus();
    if (!enabled) {
      setConnected(false);
      setReason(null);
      return;
    }
    const timer = window.setInterval(() => {
      void refreshStatus();
    }, 15000);
    return () => {
      window.clearInterval(timer);
    };
  }, [enabled, mode, dingtalkEnabled, emailEnabled, qqEnabled, refreshStatus]);

  const handleNanobotEvent = useCallback(
    (event: NanobotBridgeEvent) => {
      const timestamp = Date.now();
      setLastEventAt(timestamp);

      if (event.type === "status") {
        setConnected(event.connected);
        setReason(event.reason ?? null);
        appendLog("event", "nanobot/status-event", event, timestamp);
        return;
      }

      if (event.type === "message-sync") {
        if (event.status === "success") {
          setConnected(true);
          setReason(null);
        }
        appendLog("event", "nanobot/message-sync", event, timestamp);
        return;
      }

      if (event.type === "remote-message") {
        setConnected(true);
        setReason(null);
        appendLog("event", "nanobot/remote-message", event, timestamp);
        return;
      }

      if (event.type === "agent-trace") {
        setConnected(true);
        setReason(null);
        appendLog("event", `nanobot/agent-trace/${event.role}`, event, timestamp);
        return;
      }

      if (event.type === "stderr") {
        appendLog("stderr", "nanobot/stderr", event.message, timestamp);
      }
    },
    [appendLog],
  );

  useTauriEvent(subscribeNanobotBridgeEvents, handleNanobotEvent, { enabled: true });

  const clearLogEntries = useCallback(() => {
    setLogEntries([]);
  }, []);

  const copyLogEntries = useCallback(async () => {
    const text = logEntries
      .map((entry) => {
        const time = new Date(entry.timestamp).toLocaleTimeString();
        const payload =
          entry.payload === undefined
            ? ""
            : typeof entry.payload === "string"
              ? entry.payload
              : JSON.stringify(entry.payload, null, 2);
        return [entry.source.toUpperCase(), time, entry.label, payload]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n");
    if (text) {
      await navigator.clipboard.writeText(text);
    }
  }, [logEntries]);

  const snapshot = useMemo<NanobotRuntimeSnapshot>(
    () => ({
      enabled,
      mode,
      dingtalkEnabled,
      emailEnabled,
      qqEnabled,
      running,
      configured,
      connected: enabled ? connected : false,
      reason,
      lastEventAt,
    }),
    [
      configured,
      connected,
      dingtalkEnabled,
      emailEnabled,
      qqEnabled,
      enabled,
      lastEventAt,
      mode,
      reason,
      running,
    ],
  );

  return {
    snapshot,
    logEntries,
    clearLogEntries,
    copyLogEntries,
  };
}
