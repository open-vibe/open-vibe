import type {
  RateLimitSnapshot,
  ThemeColor,
  ThemePreference,
  ThreadSummary,
  WorkspaceInfo,
} from "../../../types";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, RefObject } from "react";
import { FolderKanban, FolderOpen, Home, Layers, Plus } from "lucide-react";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter as ShadcnSidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader as ShadcnSidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { NavUser } from "@/components/nav-user";
import { TeamSwitcher } from "@/components/team-switcher";
import { SidebarFooter } from "./SidebarFooter";
import { ThreadList } from "./ThreadList";
import { WorktreeSection } from "./WorktreeSection";
import { PinnedThreadList } from "./PinnedThreadList";
import { WorkspaceCard } from "./WorkspaceCard";
import { WorkspaceGroup } from "./WorkspaceGroup";
import { useCollapsedGroups } from "../hooks/useCollapsedGroups";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useThreadRows } from "../hooks/useThreadRows";
import { getUsageLabels } from "../utils/usageLabels";
import { formatRelativeTimeShort } from "../../../utils/time";
import { useI18n } from "../../../i18n";
import { YunyiQuotaCard } from "./YunyiQuotaCard";

const COLLAPSED_GROUPS_STORAGE_KEY = "codexmonitor.collapsedGroups";
const UNGROUPED_COLLAPSE_ID = "__ungrouped__";
const ALL_WORKSPACES_ID = "__all__";
const UNGROUPED_TEAM_ID = "__ungrouped__team__";
const ADD_MENU_WIDTH = 200;

type WorkspaceGroupSection = {
  id: string | null;
  name: string;
  workspaces: WorkspaceInfo[];
};

type SidebarContextMenu =
  | {
      type: "thread";
      workspaceId: string;
      threadId: string;
      canPin: boolean;
      x: number;
      y: number;
    }
  | { type: "workspace"; workspaceId: string; x: number; y: number }
  | { type: "worktree"; workspaceId: string; x: number; y: number };

type SidebarProps = {
  workspaces: WorkspaceInfo[];
  groupedWorkspaces: WorkspaceGroupSection[];
  hasWorkspaceGroups: boolean;
  deletingWorktreeIds: Set<string>;
  threadsByWorkspace: Record<string, ThreadSummary[]>;
  threadParentById: Record<string, string>;
  threadStatusById: Record<
    string,
    { isProcessing: boolean; hasUnread: boolean; isReviewing: boolean }
  >;
  threadListLoadingByWorkspace: Record<string, boolean>;
  threadListPagingByWorkspace: Record<string, boolean>;
  threadListCursorByWorkspace: Record<string, string | null>;
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  accountRateLimits: RateLimitSnapshot | null;
  experimentalYunyiEnabled: boolean;
  experimentalYunyiToken: string;
  themePreference: ThemePreference;
  themeColor: ThemeColor;
  onToggleTheme: () => void;
  onSelectThemeColor: (color: ThemeColor) => void;
  onOpenSettings: () => void;
  onOpenDebug: () => void;
  showDebugButton: boolean;
  onAddWorkspace: () => void;
  onSelectHome: () => void;
  onSelectWorkspace: (id: string) => void;
  onConnectWorkspace: (workspace: WorkspaceInfo) => void;
  onAddAgent: (workspace: WorkspaceInfo) => void;
  onAddWorktreeAgent: (workspace: WorkspaceInfo) => void;
  onAddCloneAgent: (workspace: WorkspaceInfo) => void;
  onToggleWorkspaceCollapse: (workspaceId: string, collapsed: boolean) => void;
  onSelectThread: (workspaceId: string, threadId: string) => void;
  onDeleteThread: (workspaceId: string, threadId: string) => void;
  onSyncThread: (workspaceId: string, threadId: string) => void;
  pinThread: (workspaceId: string, threadId: string) => boolean;
  unpinThread: (workspaceId: string, threadId: string) => void;
  isThreadPinned: (workspaceId: string, threadId: string) => boolean;
  getPinTimestamp: (workspaceId: string, threadId: string) => number | null;
  onRenameThread: (workspaceId: string, threadId: string) => void;
  onDeleteWorkspace: (workspaceId: string) => void;
  onDeleteWorktree: (workspaceId: string) => void;
  onLoadOlderThreads: (workspaceId: string) => void;
  onReloadWorkspaceThreads: (workspaceId: string) => void;
  workspaceDropTargetRef: RefObject<HTMLElement | null>;
  isWorkspaceDropActive: boolean;
  workspaceDropText: string;
  onWorkspaceDragOver: (event: React.DragEvent<HTMLElement>) => void;
  onWorkspaceDragEnter: (event: React.DragEvent<HTMLElement>) => void;
  onWorkspaceDragLeave: (event: React.DragEvent<HTMLElement>) => void;
  onWorkspaceDrop: (event: React.DragEvent<HTMLElement>) => void;
};

export function Sidebar({
  workspaces,
  groupedWorkspaces,
  hasWorkspaceGroups,
  deletingWorktreeIds,
  threadsByWorkspace,
  threadParentById,
  threadStatusById,
  threadListLoadingByWorkspace,
  threadListPagingByWorkspace,
  threadListCursorByWorkspace,
  activeWorkspaceId,
  activeThreadId,
  accountRateLimits,
  experimentalYunyiEnabled,
  experimentalYunyiToken,
  themePreference,
  themeColor,
  onToggleTheme,
  onSelectThemeColor,
  onOpenSettings,
  onOpenDebug,
  showDebugButton,
  onAddWorkspace,
  onSelectHome,
  onSelectWorkspace,
  onConnectWorkspace,
  onAddAgent,
  onAddWorktreeAgent,
  onAddCloneAgent,
  onToggleWorkspaceCollapse,
  onSelectThread,
  onDeleteThread,
  onSyncThread,
  pinThread,
  unpinThread,
  isThreadPinned,
  getPinTimestamp,
  onRenameThread,
  onDeleteWorkspace,
  onDeleteWorktree,
  onLoadOlderThreads,
  onReloadWorkspaceThreads,
  workspaceDropTargetRef,
  isWorkspaceDropActive,
  workspaceDropText,
  onWorkspaceDragOver,
  onWorkspaceDragEnter,
  onWorkspaceDragLeave,
  onWorkspaceDrop,
}: SidebarProps) {
  const { t } = useI18n();
  const [expandedWorkspaces, setExpandedWorkspaces] = useState(
    new Set<string>(),
  );
  const [activeGroupId, setActiveGroupId] = useState(ALL_WORKSPACES_ID);
  const [addMenuAnchor, setAddMenuAnchor] = useState<{
    workspaceId: string;
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<SidebarContextMenu | null>(
    null,
  );
  const addMenuRef = useRef<HTMLDivElement | null>(null);
  const { collapsedGroups, toggleGroupCollapse } = useCollapsedGroups(
    COLLAPSED_GROUPS_STORAGE_KEY,
  );
  const { getThreadRows } = useThreadRows(threadParentById);
  const showThreadMenu = useCallback(
    (
      event: MouseEvent,
      workspaceId: string,
      threadId: string,
      canPin: boolean,
    ) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({
        type: "thread",
        workspaceId,
        threadId,
        canPin,
        x: event.clientX,
        y: event.clientY,
      });
    },
    [],
  );
  const showWorkspaceMenu = useCallback(
    (event: MouseEvent, workspaceId: string) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({
        type: "workspace",
        workspaceId,
        x: event.clientX,
        y: event.clientY,
      });
    },
    [],
  );
  const showWorktreeMenu = useCallback(
    (event: MouseEvent, workspaceId: string) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({
        type: "worktree",
        workspaceId,
        x: event.clientX,
        y: event.clientY,
      });
    },
    [],
  );
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);
  const {
    sessionPercent,
    weeklyPercent,
    sessionResetLabel,
    weeklyResetLabel,
    creditsLabel,
    showWeekly,
  } = getUsageLabels(accountRateLimits);
  const workspaceCountLabel = useCallback(
    (count: number) =>
      count === 1
        ? t("sidebar.team.workspaceCount.one", { count })
        : t("sidebar.team.workspaceCount.other", { count }),
    [t],
  );
  const teamOptions = useMemo(() => {
    const options = [
      {
        id: ALL_WORKSPACES_ID,
        name: t("sidebar.team.allWorkspaces"),
        logo: Layers,
        plan: workspaceCountLabel(workspaces.length),
      },
    ];
    groupedWorkspaces.forEach((group) => {
      const groupId = group.id ?? UNGROUPED_TEAM_ID;
      options.push({
        id: groupId,
        name: group.name,
        logo: group.id ? FolderKanban : FolderOpen,
        plan: workspaceCountLabel(group.workspaces.length),
      });
    });
    return options;
  }, [groupedWorkspaces, workspaces.length, t, workspaceCountLabel]);
  const visibleGroups = useMemo(() => {
    if (activeGroupId === ALL_WORKSPACES_ID) {
      return groupedWorkspaces;
    }
    const selected = groupedWorkspaces.find(
      (group) => (group.id ?? UNGROUPED_TEAM_ID) === activeGroupId,
    );
    return selected ? [selected] : groupedWorkspaces;
  }, [activeGroupId, groupedWorkspaces]);

  const pinnedThreadRows = (() => {
    type ThreadRow = { thread: ThreadSummary; depth: number };
    const groups: Array<{
      pinTime: number;
      workspaceId: string;
      rows: ThreadRow[];
    }> = [];

    workspaces.forEach((workspace) => {
      const threads = threadsByWorkspace[workspace.id] ?? [];
      if (!threads.length) {
        return;
      }
      const { pinnedRows } = getThreadRows(
        threads,
        true,
        workspace.id,
        getPinTimestamp,
      );
      if (!pinnedRows.length) {
        return;
      }
      let currentRows: ThreadRow[] = [];
      let currentPinTime: number | null = null;

      pinnedRows.forEach((row) => {
        if (row.depth === 0) {
          if (currentRows.length && currentPinTime !== null) {
            groups.push({
              pinTime: currentPinTime,
              workspaceId: workspace.id,
              rows: currentRows,
            });
          }
          currentRows = [row];
          currentPinTime = getPinTimestamp(workspace.id, row.thread.id);
        } else {
          currentRows.push(row);
        }
      });

      if (currentRows.length && currentPinTime !== null) {
        groups.push({
          pinTime: currentPinTime,
          workspaceId: workspace.id,
          rows: currentRows,
        });
      }
    });

    return groups
      .sort((a, b) => a.pinTime - b.pinTime)
      .flatMap((group) =>
        group.rows.map((row) => ({
          ...row,
          workspaceId: group.workspaceId,
        })),
      );
  })();

  const worktreesByParent = useMemo(() => {
    const worktrees = new Map<string, WorkspaceInfo[]>();
    workspaces
      .filter((entry) => (entry.kind ?? "main") === "worktree" && entry.parentId)
      .forEach((entry) => {
        const parentId = entry.parentId as string;
        const list = worktrees.get(parentId) ?? [];
        list.push(entry);
        worktrees.set(parentId, list);
      });
    worktrees.forEach((entries) => {
      entries.sort((a, b) => a.name.localeCompare(b.name));
    });
    return worktrees;
  }, [workspaces]);

  const handleToggleExpanded = useCallback((workspaceId: string) => {
    setExpandedWorkspaces((prev) => {
      const next = new Set(prev);
      if (next.has(workspaceId)) {
        next.delete(workspaceId);
      } else {
        next.add(workspaceId);
      }
      return next;
    });
  }, []);

  const getThreadTime = useCallback(
    (thread: ThreadSummary) => {
      const timestamp = thread.updatedAt ?? null;
      return timestamp ? formatRelativeTimeShort(timestamp) : null;
    },
    [],
  );

  useEffect(() => {
    if (!addMenuAnchor) {
      return;
    }
    function handlePointerDown(event: Event) {
      const target = event.target as Node | null;
      if (addMenuRef.current && target && addMenuRef.current.contains(target)) {
        return;
      }
      setAddMenuAnchor(null);
    }
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("scroll", handlePointerDown, true);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("scroll", handlePointerDown, true);
    };
  }, [addMenuAnchor]);

  return (
    <ShadcnSidebar
      variant="inset"
      collapsible="icon"
      className="relative border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[inset_0_0_0_1px_hsl(var(--sidebar-border))]"
      data-tauri-drag-region="false"
    >
      <div
        className="relative flex h-full flex-col"
        ref={workspaceDropTargetRef as RefObject<HTMLDivElement | null>}
        onDragOver={onWorkspaceDragOver}
        onDragEnter={onWorkspaceDragEnter}
        onDragLeave={onWorkspaceDragLeave}
        onDrop={onWorkspaceDrop}
      >
        <ShadcnSidebarHeader className="px-2 pt-2">
          <TeamSwitcher
            teams={teamOptions}
            activeTeamId={activeGroupId}
            onSelectTeam={setActiveGroupId}
          />
        </ShadcnSidebarHeader>
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/70 opacity-0 backdrop-blur-sm transition-opacity",
            isWorkspaceDropActive && "pointer-events-auto opacity-100",
          )}
          aria-hidden
        >
          <div
            className={cn(
              "inline-flex items-center gap-2 text-sm font-medium text-foreground",
              workspaceDropText === "Adding Project..." && "animate-pulse",
            )}
          >
            {workspaceDropText === "Drop Project Here" && (
              <FolderOpen className="h-4 w-4" aria-hidden />
            )}
            {workspaceDropText}
          </div>
        </div>
        <SidebarContent className="gap-3 px-2 pb-3">
          <SidebarGroup className="px-0">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={onSelectHome} tooltip={t("sidebar.home")}>
                  <Home />
                  <span>{t("sidebar.home")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={onAddWorkspace}
                  tooltip={t("sidebar.addWorkspace")}
                >
                  <Plus />
                  <span>{t("sidebar.addWorkspace")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
          {pinnedThreadRows.length > 0 && (
            <SidebarGroup className="px-0">
              <SidebarGroupLabel className="px-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {t("sidebar.pinned")}
              </SidebarGroupLabel>
              <SidebarGroupContent className="px-1">
                <PinnedThreadList
                  rows={pinnedThreadRows}
                  activeWorkspaceId={activeWorkspaceId}
                  activeThreadId={activeThreadId}
                  threadStatusById={threadStatusById}
                  getThreadTime={getThreadTime}
                  isThreadPinned={isThreadPinned}
                  onSelectThread={onSelectThread}
                  onShowThreadMenu={showThreadMenu}
                />
              </SidebarGroupContent>
            </SidebarGroup>
          )}
          {visibleGroups.map((group) => {
            const groupId = group.id;
            const showGroupHeader = Boolean(groupId) || hasWorkspaceGroups;
            const toggleId = groupId ?? (showGroupHeader ? UNGROUPED_COLLAPSE_ID : null);
            const isGroupCollapsed = Boolean(
              toggleId && collapsedGroups.has(toggleId),
            );

            return (
              <WorkspaceGroup
                key={group.id ?? "ungrouped"}
                toggleId={toggleId}
                name={group.name}
                showHeader={showGroupHeader}
                isCollapsed={isGroupCollapsed}
                onToggleCollapse={toggleGroupCollapse}
              >
                {group.workspaces.map((entry) => {
                  const threads = threadsByWorkspace[entry.id] ?? [];
                  const isCollapsed = entry.settings.sidebarCollapsed;
                  const isExpanded = expandedWorkspaces.has(entry.id);
                  const {
                    unpinnedRows,
                    totalRoots: totalThreadRoots,
                  } = getThreadRows(
                    threads,
                    isExpanded,
                    entry.id,
                    getPinTimestamp,
                  );
                  const nextCursor =
                    threadListCursorByWorkspace[entry.id] ?? null;
                  const showThreadList =
                    !isCollapsed && (threads.length > 0 || Boolean(nextCursor));
                  const isPaging = threadListPagingByWorkspace[entry.id] ?? false;
                  const worktrees = worktreesByParent.get(entry.id) ?? [];
                  const addMenuOpen = addMenuAnchor?.workspaceId === entry.id;

                  return (
                    <WorkspaceCard
                      key={entry.id}
                      workspace={entry}
                      isActive={entry.id === activeWorkspaceId}
                      isCollapsed={isCollapsed}
                      addMenuOpen={addMenuOpen}
                      addMenuWidth={ADD_MENU_WIDTH}
                      onSelectWorkspace={onSelectWorkspace}
                      onShowWorkspaceMenu={showWorkspaceMenu}
                      onToggleWorkspaceCollapse={onToggleWorkspaceCollapse}
                      onConnectWorkspace={onConnectWorkspace}
                      onToggleAddMenu={setAddMenuAnchor}
                    >
                      {addMenuOpen && addMenuAnchor &&
                        createPortal(
                          <div
                            ref={addMenuRef}
                            className="fixed z-[9999] flex w-48 flex-col gap-1 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg"
                            style={{
                              top: addMenuAnchor.top,
                              left: addMenuAnchor.left,
                              width: addMenuAnchor.width,
                            }}
                          >
                            <button
                              type="button"
                              className="w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                              onClick={(event) => {
                                event.stopPropagation();
                                setAddMenuAnchor(null);
                                onAddAgent(entry);
                              }}
                            >
                              {t("sidebar.addMenu.newAgent")}
                            </button>
                            <button
                              type="button"
                              className="w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                              onClick={(event) => {
                                event.stopPropagation();
                                setAddMenuAnchor(null);
                                onAddWorktreeAgent(entry);
                              }}
                            >
                              {t("sidebar.addMenu.newWorktreeAgent")}
                            </button>
                            <button
                              type="button"
                              className="w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                              onClick={(event) => {
                                event.stopPropagation();
                                setAddMenuAnchor(null);
                                onAddCloneAgent(entry);
                              }}
                            >
                              {t("sidebar.addMenu.newCloneAgent")}
                            </button>
                          </div>,
                          document.body,
                        )}
                      {!isCollapsed && worktrees.length > 0 && (
                        <WorktreeSection
                          worktrees={worktrees}
                          deletingWorktreeIds={deletingWorktreeIds}
                          threadsByWorkspace={threadsByWorkspace}
                          threadStatusById={threadStatusById}
                          threadListLoadingByWorkspace={threadListLoadingByWorkspace}
                          threadListPagingByWorkspace={threadListPagingByWorkspace}
                          threadListCursorByWorkspace={threadListCursorByWorkspace}
                          expandedWorkspaces={expandedWorkspaces}
                          activeWorkspaceId={activeWorkspaceId}
                          activeThreadId={activeThreadId}
                          getThreadRows={getThreadRows}
                          getThreadTime={getThreadTime}
                          isThreadPinned={isThreadPinned}
                          getPinTimestamp={getPinTimestamp}
                          onSelectWorkspace={onSelectWorkspace}
                          onConnectWorkspace={onConnectWorkspace}
                          onToggleWorkspaceCollapse={onToggleWorkspaceCollapse}
                          onSelectThread={onSelectThread}
                          onRenameThread={onRenameThread}
                          onShowThreadMenu={showThreadMenu}
                          onShowWorktreeMenu={showWorktreeMenu}
                          onToggleExpanded={handleToggleExpanded}
                          onLoadOlderThreads={onLoadOlderThreads}
                        />
                      )}
                      {showThreadList && (
                        <ThreadList
                          workspaceId={entry.id}
                          pinnedRows={[]}
                          unpinnedRows={unpinnedRows}
                          totalThreadRoots={totalThreadRoots}
                          isExpanded={isExpanded}
                          nextCursor={nextCursor}
                          isPaging={isPaging}
                          showLoadOlder={false}
                          activeWorkspaceId={activeWorkspaceId}
                          activeThreadId={activeThreadId}
                          threadStatusById={threadStatusById}
                          getThreadTime={getThreadTime}
                          isThreadPinned={isThreadPinned}
                          onToggleExpanded={handleToggleExpanded}
                          onLoadOlderThreads={onLoadOlderThreads}
                          onSelectThread={onSelectThread}
                          onRenameThread={onRenameThread}
                          onShowThreadMenu={showThreadMenu}
                        />
                      )}
                    </WorkspaceCard>
                  );
                })}
              </WorkspaceGroup>
            );
          })}
          {!groupedWorkspaces.length && (
            <div className="px-2 py-4 text-xs text-muted-foreground">
              {t("sidebar.empty")}
            </div>
          )}
          <SidebarGroup className="mt-2 px-0">
            <SidebarGroupLabel className="px-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {t("sidebar.usage")}
            </SidebarGroupLabel>
            <SidebarGroupContent className="px-1">
              <SidebarFooter
                sessionPercent={sessionPercent}
                weeklyPercent={weeklyPercent}
                sessionResetLabel={sessionResetLabel}
                weeklyResetLabel={weeklyResetLabel}
                creditsLabel={creditsLabel}
                showWeekly={showWeekly}
              />
            </SidebarGroupContent>
          </SidebarGroup>
          {experimentalYunyiEnabled && (
            <SidebarGroup className="mt-2 px-0 group-data-[collapsible=icon]/sidebar-wrapper:hidden">
              <SidebarGroupLabel className="px-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {t("sidebar.yunyi.title")}
              </SidebarGroupLabel>
              <SidebarGroupContent className="px-2 pb-2">
                <YunyiQuotaCard token={experimentalYunyiToken} />
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>
        <ShadcnSidebarFooter className="px-2 pb-3">
          <NavUser
            user={{
              name: "OpenVibe",
              email: t("sidebar.user.localWorkspace"),
              avatar: "",
            }}
            themePreference={themePreference}
            themeColor={themeColor}
            onToggleTheme={onToggleTheme}
            onSelectThemeColor={onSelectThemeColor}
            onOpenSettings={onOpenSettings}
            onOpenDebug={onOpenDebug}
            showDebugButton={showDebugButton}
          />
        </ShadcnSidebarFooter>
      </div>
      {contextMenu &&
        createPortal(
          <DropdownMenu
            open
            onOpenChange={(open) => {
              if (!open) {
                closeContextMenu();
              }
            }}
          >
            <DropdownMenuTrigger asChild>
              <div
                style={{
                  position: "fixed",
                  left: contextMenu.x,
                  top: contextMenu.y,
                  width: 1,
                  height: 1,
                }}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent sideOffset={6} align="start" className="w-52">
              {contextMenu.type === "thread" && (
                <>
                  <DropdownMenuItem
                    onSelect={() => {
                      onRenameThread(contextMenu.workspaceId, contextMenu.threadId);
                      closeContextMenu();
                    }}
                  >
                    {t("sidebar.menu.rename")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      onSyncThread(contextMenu.workspaceId, contextMenu.threadId);
                      closeContextMenu();
                    }}
                  >
                    {t("sidebar.menu.sync")}
                  </DropdownMenuItem>
                  {contextMenu.canPin && (
                    <DropdownMenuItem
                      onSelect={() => {
                        const pinned = isThreadPinned(
                          contextMenu.workspaceId,
                          contextMenu.threadId,
                        );
                        if (pinned) {
                          unpinThread(contextMenu.workspaceId, contextMenu.threadId);
                        } else {
                          pinThread(contextMenu.workspaceId, contextMenu.threadId);
                        }
                        closeContextMenu();
                      }}
                    >
                      {isThreadPinned(contextMenu.workspaceId, contextMenu.threadId)
                        ? t("sidebar.menu.unpin")
                        : t("sidebar.menu.pin")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => {
                      void navigator.clipboard
                        .writeText(contextMenu.threadId)
                        .catch(() => undefined);
                      closeContextMenu();
                    }}
                  >
                    {t("sidebar.menu.copyId")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => {
                      onDeleteThread(contextMenu.workspaceId, contextMenu.threadId);
                      closeContextMenu();
                    }}
                  >
                    {t("sidebar.menu.archive")}
                  </DropdownMenuItem>
                </>
              )}
              {contextMenu.type === "workspace" && (
                <>
                  <DropdownMenuItem
                    onSelect={() => {
                      onReloadWorkspaceThreads(contextMenu.workspaceId);
                      closeContextMenu();
                    }}
                  >
                    {t("sidebar.menu.reloadThreads")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => {
                      onDeleteWorkspace(contextMenu.workspaceId);
                      closeContextMenu();
                    }}
                  >
                    {t("sidebar.menu.delete")}
                  </DropdownMenuItem>
                </>
              )}
              {contextMenu.type === "worktree" && (
                <>
                  <DropdownMenuItem
                    onSelect={() => {
                      onReloadWorkspaceThreads(contextMenu.workspaceId);
                      closeContextMenu();
                    }}
                  >
                    {t("sidebar.menu.reloadThreads")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => {
                      onDeleteWorktree(contextMenu.workspaceId);
                      closeContextMenu();
                    }}
                  >
                    {t("sidebar.menu.deleteWorktree")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>,
          document.body,
        )}
      <SidebarRail />
    </ShadcnSidebar>
  );
}
