import type { CSSProperties, MouseEvent } from "react";
import { Pin } from "lucide-react";

import type { ThreadSummary } from "../../../types";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type ThreadStatusMap = Record<
  string,
  { isProcessing: boolean; hasUnread: boolean; isReviewing: boolean }
>;

type PinnedThreadRow = {
  thread: ThreadSummary;
  depth: number;
  workspaceId: string;
};

type PinnedThreadListProps = {
  rows: PinnedThreadRow[];
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  threadStatusById: ThreadStatusMap;
  getThreadTime: (thread: ThreadSummary) => string | null;
  isThreadPinned: (workspaceId: string, threadId: string) => boolean;
  onSelectThread: (workspaceId: string, threadId: string) => void;
  onShowThreadMenu: (
    event: MouseEvent,
    workspaceId: string,
    threadId: string,
    canPin: boolean,
  ) => void;
};

export function PinnedThreadList({
  rows,
  activeWorkspaceId,
  activeThreadId,
  threadStatusById,
  getThreadTime,
  isThreadPinned,
  onSelectThread,
  onShowThreadMenu,
}: PinnedThreadListProps) {
  return (
    <SidebarMenu className="gap-1">
      {rows.map(({ thread, depth, workspaceId }) => {
        const relativeTime = getThreadTime(thread);
        const indentStyle =
          depth > 0
            ? ({ paddingLeft: `${8 + depth * 14}px` } as CSSProperties)
            : undefined;
        const status = threadStatusById[thread.id];
        const canPin = depth === 0;
        const isPinned = canPin && isThreadPinned(workspaceId, thread.id);
        const isActive =
          workspaceId === activeWorkspaceId && thread.id === activeThreadId;
        const statusType = status?.isReviewing
          ? "reviewing"
          : status?.isProcessing
            ? "processing"
            : status?.hasUnread
              ? "unread"
              : "ready";
        const statusClass = cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          statusType === "reviewing" &&
            "bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.7)]",
          statusType === "processing" &&
            "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)] animate-pulse",
          statusType === "unread" &&
            "bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.7)]",
          statusType === "ready" &&
            (isActive
              ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
              : "bg-muted-foreground/50"),
        );

        return (
          <SidebarMenuItem key={`${workspaceId}:${thread.id}`}>
            <SidebarMenuButton
              asChild
              isActive={isActive}
              onClick={() => onSelectThread(workspaceId, thread.id)}
              onContextMenu={(event) =>
                onShowThreadMenu(event, workspaceId, thread.id, canPin)
              }
              style={indentStyle}
              className={cn(
                "h-7 rounded-md px-2 text-xs",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
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
      })}
    </SidebarMenu>
  );
}
