import type { DebugEntry } from "../types";

type DebugLogger = (entry: DebugEntry) => void;

type SoundLabel = "success" | "error" | "test";

type SoundOptions = {
  volume?: number;
  onDebug?: DebugLogger;
};

export function playNotificationSound(
  url: string,
  label: SoundLabel,
  options?: SoundOptions,
) {
  try {
    const audio = new Audio(url);
    const volume =
      typeof options?.volume === "number" && Number.isFinite(options.volume)
        ? Math.min(1, Math.max(0, options.volume))
        : 0.05;
    audio.volume = volume;
    audio.preload = "auto";
    audio.addEventListener("error", () => {
      options?.onDebug?.({
        id: `${Date.now()}-audio-${label}-load-error`,
        timestamp: Date.now(),
        source: "error",
        label: `audio/${label} load error`,
        payload: `Failed to load audio: ${url}`,
      });
    });
    void audio.play().catch((error) => {
      options?.onDebug?.({
        id: `${Date.now()}-audio-${label}-play-error`,
        timestamp: Date.now(),
        source: "error",
        label: `audio/${label} play error`,
        payload: error instanceof Error ? error.message : String(error),
      });
    });
  } catch (error) {
    options?.onDebug?.({
      id: `${Date.now()}-audio-${label}-init-error`,
      timestamp: Date.now(),
      source: "error",
      label: `audio/${label} init error`,
      payload: error instanceof Error ? error.message : String(error),
    });
  }
}
