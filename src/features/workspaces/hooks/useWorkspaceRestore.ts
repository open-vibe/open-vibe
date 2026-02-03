import { useEffect, useRef } from "react";
import type { WorkspaceInfo } from "../../../types";

type WorkspaceRestoreOptions = {
  workspaces: WorkspaceInfo[];
  hasLoaded: boolean;
  listThreadsForWorkspace: (workspace: WorkspaceInfo) => Promise<void>;
};

export function useWorkspaceRestore({
  workspaces,
  hasLoaded,
  listThreadsForWorkspace,
}: WorkspaceRestoreOptions) {
  const restoredWorkspaces = useRef(new Set<string>());

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }
    workspaces.forEach((workspace) => {
      if (restoredWorkspaces.current.has(workspace.id)) {
        return;
      }
      restoredWorkspaces.current.add(workspace.id);
      void (async () => {
        try {
          await listThreadsForWorkspace(workspace);
        } catch {
          // Silent: connection errors show in debug panel.
        }
      })();
    });
    return () => {
    };
  }, [
    hasLoaded,
    listThreadsForWorkspace,
    workspaces,
  ]);
}
