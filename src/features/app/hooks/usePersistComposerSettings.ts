import { useEffect } from "react";
import type { AccessMode, AppSettings } from "../../../types";

type Params = {
  appSettingsLoading: boolean;
  selectedModelId: string | null;
  accessMode: AccessMode;
  selectedEffort: string | null;
  setAppSettings: (updater: (current: AppSettings) => AppSettings) => void;
  queueSaveSettings: (next: AppSettings) => Promise<AppSettings>;
};

export function usePersistComposerSettings({
  appSettingsLoading,
  selectedModelId,
  accessMode,
  selectedEffort,
  setAppSettings,
  queueSaveSettings,
}: Params) {
  useEffect(() => {
    if (appSettingsLoading) {
      return;
    }
    if (!selectedModelId && selectedEffort === null) {
      return;
    }
    setAppSettings((current) => {
      if (
        current.lastComposerModelId === selectedModelId &&
        current.lastComposerAccessMode === accessMode &&
        current.lastComposerReasoningEffort === selectedEffort
      ) {
        return current;
      }
      const nextSettings = {
        ...current,
        lastComposerModelId: selectedModelId,
        lastComposerAccessMode: accessMode,
        lastComposerReasoningEffort: selectedEffort,
      };
      void queueSaveSettings(nextSettings);
      return nextSettings;
    });
  }, [
    appSettingsLoading,
    accessMode,
    queueSaveSettings,
    selectedEffort,
    selectedModelId,
    setAppSettings,
  ]);
}
