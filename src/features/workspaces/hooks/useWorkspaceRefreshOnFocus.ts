import { useEffect } from "react";
import type { WorkspaceInfo } from "../../../types";

type WorkspaceRefreshOptions = {
  workspaces: WorkspaceInfo[];
  refreshWorkspaces: () => Promise<WorkspaceInfo[] | void>;
  listThreadsForWorkspace: (workspace: WorkspaceInfo) => Promise<void>;
  enabled?: boolean;
};

export function useWorkspaceRefreshOnFocus({
  workspaces,
  refreshWorkspaces,
  listThreadsForWorkspace,
  enabled = true,
}: WorkspaceRefreshOptions) {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const handleFocus = () => {
      void (async () => {
        let latestWorkspaces = workspaces;
        try {
          const entries = await refreshWorkspaces();
          if (entries) {
            latestWorkspaces = entries;
          }
        } catch {
          // Silent: refresh errors show in debug panel.
        }
        await Promise.allSettled(
          latestWorkspaces.map((workspace) => listThreadsForWorkspace(workspace)),
        );
      })();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleFocus();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, listThreadsForWorkspace, refreshWorkspaces, workspaces]);
}
