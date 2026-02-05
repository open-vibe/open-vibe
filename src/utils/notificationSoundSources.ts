import { convertFileSrc } from "@tauri-apps/api/core";
import defaultErrorSoundUrl from "../assets/error-notification.mp3";
import defaultSuccessSoundUrl from "../assets/success-notification.mp3";
import {
  CUSTOM_NOTIFICATION_SOUND_ID,
  DEFAULT_NOTIFICATION_ERROR_ID,
  DEFAULT_NOTIFICATION_SUCCESS_ID,
} from "./notificationSoundDefaults";

type SoundSource = {
  id: string;
  label: string;
  url: string;
};

const bundledAudio = import.meta.glob("../assets/audio/*.aac", {
  eager: true,
  as: "url",
}) as Record<string, string>;

const bundledSoundSources = Object.entries(bundledAudio)
  .map(([path, url]) => {
    const filename = path.split("/").pop() ?? path;
    const basename = filename.replace(/\.[^/.]+$/, "");
    const label = basename
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
    return {
      id: basename,
      label,
      url,
    };
  })
  .sort((a, b) => a.label.localeCompare(b.label));

const builtinSoundSources: SoundSource[] = [
  {
    id: DEFAULT_NOTIFICATION_SUCCESS_ID,
    label: "Default success",
    url: defaultSuccessSoundUrl,
  },
  {
    id: DEFAULT_NOTIFICATION_ERROR_ID,
    label: "Default error",
    url: defaultErrorSoundUrl,
  },
  ...bundledSoundSources,
];

const builtinSoundUrlById = new Map(
  builtinSoundSources.map((source) => [source.id, source.url]),
);

export const notificationSoundOptions = bundledSoundSources;
export const defaultNotificationSuccessSoundUrl = defaultSuccessSoundUrl;
export const defaultNotificationErrorSoundUrl = defaultErrorSoundUrl;

export function resolveNotificationSoundUrl({
  soundId,
  soundPath,
  fallbackUrl,
}: {
  soundId?: string | null;
  soundPath?: string | null;
  fallbackUrl: string;
}) {
  if (soundPath) {
    return convertFileSrc(soundPath);
  }
  const url = soundId ? builtinSoundUrlById.get(soundId) : null;
  return url ?? fallbackUrl;
}

export function normalizeNotificationSoundId(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  if (value === CUSTOM_NOTIFICATION_SOUND_ID) {
    return value;
  }
  if (builtinSoundUrlById.has(value)) {
    return value;
  }
  return null;
}
