import type { MouseEvent } from "react";
import { ChevronDown, Folder, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import type { WorkspaceInfo } from "../../../types";

type WorkspaceCardProps = {
  workspace: WorkspaceInfo;
  isActive: boolean;
  isCollapsed: boolean;
  addMenuOpen: boolean;
  addMenuWidth: number;
  onSelectWorkspace: (id: string) => void;
  onShowWorkspaceMenu: (event: MouseEvent, workspaceId: string) => void;
  onToggleWorkspaceCollapse: (workspaceId: string, collapsed: boolean) => void;
  onConnectWorkspace: (workspace: WorkspaceInfo) => void;
  onToggleAddMenu: (anchor: {
    workspaceId: string;
    top: number;
    left: number;
    width: number;
  } | null) => void;
  children?: React.ReactNode;
};

export function WorkspaceCard({
  workspace,
  isActive,
  isCollapsed,
  addMenuOpen,
  addMenuWidth,
  onSelectWorkspace,
  onShowWorkspaceMenu,
  onToggleWorkspaceCollapse,
  onConnectWorkspace,
  onToggleAddMenu,
  children,
}: WorkspaceCardProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        onClick={() => onSelectWorkspace(workspace.id)}
        onContextMenu={(event) => onShowWorkspaceMenu(event, workspace.id)}
        className={cn(
          "h-9 rounded-md px-2 text-sm",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
        )}
        data-tauri-drag-region="false"
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectWorkspace(workspace.id);
          }
        }}
      >
        <div role="button" tabIndex={0} className="flex min-w-0 flex-1 items-center gap-2">
          <Folder className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate font-medium">
            {workspace.name}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {!workspace.connected && (
              <button
                type="button"
                className="cursor-pointer select-none rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground"
                onClick={(event) => {
                  event.stopPropagation();
                  onConnectWorkspace(workspace);
                }}
                data-tauri-drag-region="false"
              >
                Connect
              </button>
            )}
              <button
                type="button"
                className={cn(
                  "text-muted-foreground cursor-pointer opacity-0 transition-all group-hover/menu-item:opacity-100",
                  !isCollapsed && "rotate-180",
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleWorkspaceCollapse(workspace.id, !isCollapsed);
              }}
              data-tauri-drag-region="false"
              aria-label={isCollapsed ? "Show agents" : "Hide agents"}
              aria-expanded={!isCollapsed}
            >
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-border bg-background text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-accent-foreground group-hover/menu-item:opacity-100"
              onClick={(event) => {
                event.stopPropagation();
                const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                const left = Math.min(
                  Math.max(rect.left, 12),
                  window.innerWidth - addMenuWidth - 12,
                );
                const top = rect.bottom + 8;
                onToggleAddMenu(
                  addMenuOpen
                    ? null
                    : {
                        workspaceId: workspace.id,
                        top,
                        left,
                        width: addMenuWidth,
                      },
                );
              }}
              data-tauri-drag-region="false"
              aria-label="Add agent options"
              aria-expanded={addMenuOpen}
            >
              <Plus className="h-3 w-3" aria-hidden />
            </button>
          </div>
        </div>
      </SidebarMenuButton>
      {children}
    </SidebarMenuItem>
  );
}
