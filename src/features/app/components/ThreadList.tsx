import type { CSSProperties, MouseEvent } from "react";
import { Pin } from "lucide-react";

import type { ThreadSummary } from "../../../types";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type ThreadStatusMap = Record<
  string,
  { isProcessing: boolean; hasUnread: boolean; isReviewing: boolean }
>;

type ThreadRow = {
  thread: ThreadSummary;
  depth: number;
};

type ThreadListProps = {
  workspaceId: string;
  openThreadIds: Set<string>;
  pinnedRows: ThreadRow[];
  unpinnedRows: ThreadRow[];
  totalThreadRoots: number;
  isExpanded: boolean;
  nextCursor: string | null;
  isPaging: boolean;
  nested?: boolean;
  showLoadOlder?: boolean;
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  threadStatusById: ThreadStatusMap;
  getThreadTime: (thread: ThreadSummary) => string | null;
  isThreadPinned: (workspaceId: string, threadId: string) => boolean;
  onToggleExpanded: (workspaceId: string) => void;
  onLoadOlderThreads: (workspaceId: string) => void;
  onSelectThread: (workspaceId: string, threadId: string) => void;
  onRenameThread: (workspaceId: string, threadId: string) => void;
  onShowThreadMenu: (
    event: MouseEvent,
    workspaceId: string,
    threadId: string,
    canPin: boolean,
  ) => void;
};

export function ThreadList({
  workspaceId,
  openThreadIds,
  pinnedRows,
  unpinnedRows,
  totalThreadRoots,
  isExpanded,
  nextCursor,
  isPaging,
  nested,
  showLoadOlder = false,
  activeWorkspaceId,
  activeThreadId,
  threadStatusById,
  getThreadTime,
  isThreadPinned,
  onToggleExpanded,
  onLoadOlderThreads,
  onSelectThread,
  onRenameThread,
  onShowThreadMenu,
}: ThreadListProps) {
  const indentUnit = nested ? 10 : 14;
  const renderThreadRow = ({ thread, depth }: ThreadRow) => {
    const relativeTime = getThreadTime(thread);
    const indentStyle =
      depth > 0
        ? ({ paddingLeft: `${8 + depth * indentUnit}px` } as CSSProperties)
        : undefined;
    const status = threadStatusById[thread.id];
    const canPin = depth === 0;
    const isPinned = canPin && isThreadPinned(workspaceId, thread.id);
    const isActive =
      workspaceId === activeWorkspaceId && thread.id === activeThreadId;
    const isOpen =
      isActive || openThreadIds.has(`${workspaceId}:${thread.id}`);
    const statusType = status?.isReviewing
      ? "reviewing"
      : status?.isProcessing
        ? "processing"
        : status?.hasUnread
          ? "unread"
          : "ready";
    const showOpenReady = statusType === "ready" && isOpen;
    const showActiveRipple = statusType === "ready" && isActive;
    const statusClass = cn(
      "h-1.5 w-1.5 shrink-0 rounded-full",
      statusType === "reviewing" &&
        "bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.7)]",
      statusType === "processing" &&
        "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)] animate-pulse",
      statusType === "unread" &&
        "bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.7)]",
      statusType === "ready" &&
        (showOpenReady
          ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
          : "bg-muted-foreground/50"),
      showActiveRipple && "thread-status-ripple",
    );

    return (
      <SidebarMenuItem key={thread.id}>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          onClick={() => onSelectThread(workspaceId, thread.id)}
          onContextMenu={(event) =>
            onShowThreadMenu(event, workspaceId, thread.id, canPin)
          }
          onDoubleClick={() => onRenameThread(workspaceId, thread.id)}
          style={indentStyle}
          className={cn(
            "h-7 rounded-md px-2 text-xs",
            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
            nested && "text-[11px]",
          )}
          data-thread-row="true"
          data-tauri-drag-region="false"
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelectThread(workspaceId, thread.id);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={statusClass}
              data-thread-status={statusType}
              aria-hidden
            />
            {isPinned && (
              <Pin className="h-3 w-3 text-muted-foreground" aria-label="Pinned" />
            )}
            <span className="min-w-0 flex-1 truncate">{thread.name}</span>
            <div className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">
              {relativeTime && (
                <span className="tabular-nums">{relativeTime}</span>
              )}
            </div>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const menu = (
    <SidebarMenu className={cn("gap-1", nested && "pl-2")}>
      {pinnedRows.map((row) => renderThreadRow(row))}
      {pinnedRows.length > 0 && unpinnedRows.length > 0 && (
        <div className="my-1 h-px bg-border/70" aria-hidden="true" />
      )}
      {unpinnedRows.map((row) => renderThreadRow(row))}
      {totalThreadRoots > 3 && (
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpanded(workspaceId);
            }}
            className="h-7 justify-start text-xs text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? "Show less" : "More..."}
          </SidebarMenuButton>
        </SidebarMenuItem>
      )}
      {showLoadOlder && nextCursor && (isExpanded || totalThreadRoots <= 3) && (
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={(event) => {
              event.stopPropagation();
              onLoadOlderThreads(workspaceId);
            }}
            disabled={isPaging}
            className="h-7 justify-start text-xs text-muted-foreground hover:text-foreground"
          >
            {isPaging
              ? "Loading..."
              : totalThreadRoots === 0
                ? "Search older..."
                : "Load older..."}
          </SidebarMenuButton>
        </SidebarMenuItem>
      )}
    </SidebarMenu>
  );

  if (nested) {
    return menu;
  }

  return (
    <div className="mt-px rounded-md border border-border/50 bg-sidebar-accent/5">
      {menu}
    </div>
  );
}
