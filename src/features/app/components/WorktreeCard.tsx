import type { MouseEvent } from "react";
import { ChevronDown, GitBranch } from "lucide-react";

import { cn } from "@/lib/utils";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import type { WorkspaceInfo } from "../../../types";

type WorktreeCardProps = {
  worktree: WorkspaceInfo;
  isActive: boolean;
  isDeleting?: boolean;
  onSelectWorkspace: (id: string) => void;
  onShowWorktreeMenu: (event: MouseEvent, workspaceId: string) => void;
  onToggleWorkspaceCollapse: (workspaceId: string, collapsed: boolean) => void;
  onConnectWorkspace: (workspace: WorkspaceInfo) => void;
  children?: React.ReactNode;
};

export function WorktreeCard({
  worktree,
  isActive,
  isDeleting = false,
  onSelectWorkspace,
  onShowWorktreeMenu,
  onToggleWorkspaceCollapse,
  onConnectWorkspace,
  children,
}: WorktreeCardProps) {
  const worktreeCollapsed = worktree.settings.sidebarCollapsed;
  const worktreeBranch = worktree.worktree?.branch ?? "";
  const label = worktreeBranch || worktree.name;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        onClick={() => {
          if (!isDeleting) {
            onSelectWorkspace(worktree.id);
          }
        }}
        onContextMenu={(event) => {
          if (!isDeleting) {
            onShowWorktreeMenu(event, worktree.id);
          }
        }}
        onKeyDown={(event) => {
          if (isDeleting) {
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectWorkspace(worktree.id);
          }
        }}
        className={cn(
          "h-8 rounded-md px-2 text-xs",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
        )}
        data-tauri-drag-region="false"
      >
        <div
          role="button"
          tabIndex={isDeleting ? -1 : 0}
          aria-disabled={isDeleting}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2",
            isDeleting && "opacity-60",
          )}
        >
          <GitBranch className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <div className="ml-auto flex items-center gap-2">
            {isDeleting ? (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span
                  className="h-3 w-3 animate-spin rounded-full border border-border border-t-foreground"
                  aria-hidden
                />
                <span>Deleting</span>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className={cn(
                    "text-muted-foreground cursor-pointer opacity-0 transition-all group-hover/menu-item:opacity-100",
                    !worktreeCollapsed && "rotate-180",
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleWorkspaceCollapse(worktree.id, !worktreeCollapsed);
                  }}
                  data-tauri-drag-region="false"
                  aria-label={worktreeCollapsed ? "Show agents" : "Hide agents"}
                  aria-expanded={!worktreeCollapsed}
                >
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                </button>
                {!worktree.connected && (
                  <button
                    type="button"
                    className="cursor-pointer select-none rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground"
                    onClick={(event) => {
                      event.stopPropagation();
                      onConnectWorkspace(worktree);
                    }}
                    data-tauri-drag-region="false"
                  >
                    Connect
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </SidebarMenuButton>
      {children}
    </SidebarMenuItem>
  );
}
