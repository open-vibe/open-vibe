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
          "h-9 rounded-lg px-2",
          "hover:bg-[var(--surface-hover)] hover:text-[var(--text-strong)]",
          "data-[active=true]:bg-[var(--surface-active)] data-[active=true]:text-[var(--text-strong)]",
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
                className="rounded-full border border-[var(--border-quiet)] px-2 py-0.5 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--border-stronger)] hover:text-[var(--text-strong)]"
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
                "text-[var(--text-muted)] opacity-0 transition-all group-hover/menu-item:opacity-100",
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
              className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border-stronger)] bg-[var(--surface-card-muted)] text-[var(--text-muted)] opacity-0 transition-opacity hover:bg-[var(--surface-card-strong)] hover:text-[var(--text-strong)] group-hover/menu-item:opacity-100"
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
