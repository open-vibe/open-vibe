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
import { Bot, ChevronDown, FolderKanban, FolderOpen, Home, Layers, Plus } from "lucide-react";
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
import { NanobotStatusCard } from "./NanobotStatusCard";
import { WorkspaceAppearanceDialog } from "./WorkspaceAppearanceDialog";

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
  openThreadIds: Set<string>;
  threadListLoadingByWorkspace: Record<string, boolean>;
  threadListPagingByWorkspace: Record<string, boolean>;
  threadListCursorByWorkspace: Record<string, string | null>;
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  accountRateLimits: RateLimitSnapshot | null;
  experimentalYunyiEnabled: boolean;
  experimentalYunyiToken: string;
  nanobotStatus: {
    enabled: boolean;
    mode: "bridge" | "agent";
    dingtalkEnabled: boolean;
    emailEnabled: boolean;
    qqEnabled: boolean;
    running: boolean;
    configured: boolean;
    connected: boolean;
    reason: string | null;
    lastEventAt: number | null;
  };
  nanobotPresence?: {
    bluetoothEnabled: boolean;
    bluetoothSupported: boolean;
    bluetoothScanning: boolean;
    bluetoothNearby: boolean | null;
  };
  themePreference: ThemePreference;
  themeColor: ThemeColor;
  compactSidebar: boolean;
  onToggleTheme: () => void;
  onSelectThemeColor: (color: ThemeColor) => void;
  onOpenSettings: () => void;
  onOpenDebug: () => void;
  onOpenNanobotLog: () => void;
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
  onUpdateWorkspaceSettings: (
    workspaceId: string,
    patch: Partial<WorkspaceInfo["settings"]>,
  ) => Promise<void>;
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
  openThreadIds,
  threadListLoadingByWorkspace,
  threadListPagingByWorkspace,
  threadListCursorByWorkspace,
  activeWorkspaceId,
  activeThreadId,
  accountRateLimits,
  experimentalYunyiEnabled,
  experimentalYunyiToken,
  nanobotStatus,
  nanobotPresence,
  themePreference,
  themeColor,
  compactSidebar,
  onToggleTheme,
  onSelectThemeColor,
  onOpenSettings,
  onOpenDebug,
  onOpenNanobotLog,
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
  onUpdateWorkspaceSettings,
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
  const resolvedNanobotPresence = nanobotPresence ?? {
    bluetoothEnabled: false,
    bluetoothSupported: false,
    bluetoothScanning: false,
    bluetoothNearby: null,
  };
  const nanobotConnectionStatus = !nanobotStatus.enabled
    ? t("sidebar.nanobot.status.disabled")
    : nanobotStatus.connected
      ? t("sidebar.nanobot.status.connected")
      : nanobotStatus.running
        ? t("sidebar.nanobot.status.connecting")
        : t("sidebar.nanobot.status.disconnected");
  const nanobotModeValue =
    nanobotStatus.mode === "bridge"
      ? t("sidebar.nanobot.mode.bridge")
      : t("sidebar.nanobot.mode.agent");
  const nanobotChannelValue =
    [
      nanobotStatus.dingtalkEnabled ? t("sidebar.nanobot.channel.dingtalk") : null,
      nanobotStatus.emailEnabled ? t("sidebar.nanobot.channel.email") : null,
      nanobotStatus.qqEnabled ? t("sidebar.nanobot.channel.qq") : null,
    ]
      .filter((item): item is string => Boolean(item))
      .join(" + ") || t("sidebar.nanobot.channel.disabled");
  const nanobotRuntimeValue =
    nanobotStatus.running && nanobotStatus.configured
      ? t("sidebar.nanobot.runtime.running")
      : t("sidebar.nanobot.runtime.stopped");
  const nanobotLastEventValue = nanobotStatus.lastEventAt
    ? formatRelativeTimeShort(nanobotStatus.lastEventAt)
    : t("sidebar.nanobot.lastEvent.none");
  const nanobotBluetoothLabel = t("sidebar.nanobot.bluetooth", {
    value: !resolvedNanobotPresence.bluetoothEnabled
      ? t("sidebar.nanobot.bluetooth.disabled")
      : resolvedNanobotPresence.bluetoothScanning
        ? t("sidebar.nanobot.bluetooth.scanning")
        : resolvedNanobotPresence.bluetoothSupported
          ? t("sidebar.nanobot.bluetooth.connected")
          : t("sidebar.nanobot.bluetooth.disconnected"),
  });
  const nanobotNearbyLabel = t("sidebar.nanobot.nearby", {
    value: !resolvedNanobotPresence.bluetoothEnabled
      ? t("sidebar.nanobot.nearby.disabled")
      : resolvedNanobotPresence.bluetoothNearby === true
        ? t("sidebar.nanobot.nearby.present")
        : resolvedNanobotPresence.bluetoothNearby === false
          ? t("sidebar.nanobot.nearby.away")
          : t("sidebar.nanobot.nearby.unknown"),
  });
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
  const [appearanceWorkspaceId, setAppearanceWorkspaceId] = useState<string | null>(
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
  const appearanceWorkspace = useMemo(
    () =>
      appearanceWorkspaceId
        ? workspaces.find((workspace) => workspace.id === appearanceWorkspaceId) ?? null
        : null,
    [appearanceWorkspaceId, workspaces],
  );
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
  const regularWorkspaces = useMemo(
    () => workspaces.filter((workspace) => (workspace.kind ?? "main") !== "nanobot"),
    [workspaces],
  );
  const nanobotWorkspace = useMemo(
    () =>
      workspaces.find(
        (workspace) =>
          (workspace.kind ?? "main") === "nanobot" &&
          (workspace.parentId ?? null) === null,
      ) ?? null,
    [workspaces],
  );
  const teamOptions = useMemo(() => {
    const options = [
      {
        id: ALL_WORKSPACES_ID,
        name: t("sidebar.team.allWorkspaces"),
        logo: Layers,
        plan: workspaceCountLabel(regularWorkspaces.length),
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
  }, [groupedWorkspaces, regularWorkspaces.length, t, workspaceCountLabel]);
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

    regularWorkspaces.forEach((workspace) => {
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
    regularWorkspaces
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
  }, [regularWorkspaces]);

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
  const nanobotThreads = nanobotWorkspace
    ? threadsByWorkspace[nanobotWorkspace.id] ?? []
    : [];
  const nanobotNextCursor = nanobotWorkspace
    ? threadListCursorByWorkspace[nanobotWorkspace.id] ?? null
    : null;
  const nanobotIsPaging = nanobotWorkspace
    ? threadListPagingByWorkspace[nanobotWorkspace.id] ?? false
    : false;
  const nanobotIsExpanded = nanobotWorkspace
    ? expandedWorkspaces.has(nanobotWorkspace.id)
    : false;
  const nanobotIsCollapsed = nanobotWorkspace
    ? nanobotWorkspace.settings.sidebarCollapsed
    : true;
  const nanobotThreadRows = nanobotWorkspace
    ? getThreadRows(
        nanobotThreads,
        nanobotIsExpanded,
        nanobotWorkspace.id,
        getPinTimestamp,
      )
    : { unpinnedRows: [], totalRoots: 0 };

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
      className={cn(
        "relative border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[inset_0_0_0_1px_hsl(var(--sidebar-border))]",
        compactSidebar && "sidebar-compact",
      )}
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
        <ShadcnSidebarHeader className={cn("px-2 pt-2", compactSidebar && "pt-1 pb-1")}>
          <TeamSwitcher
            teams={teamOptions}
            activeTeamId={activeGroupId}
            onSelectTeam={setActiveGroupId}
            compact={compactSidebar}
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
        <SidebarContent className={cn("sidebar-scroll-area overflow-hidden px-2 pb-1", compactSidebar && "pb-0")}>
          <div className={cn("flex min-h-0 flex-1 flex-col gap-3", compactSidebar && "gap-1.5")}>
            <SidebarGroup className="shrink-0 px-0">
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
              <SidebarGroup className="shrink-0 px-0">
                <SidebarGroupLabel className="px-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {t("sidebar.pinned")}
                </SidebarGroupLabel>
                <SidebarGroupContent className="px-1">
                  <PinnedThreadList
                    rows={pinnedThreadRows}
                    openThreadIds={openThreadIds}
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
            <div className={cn("sidebar-scroll-area min-h-0 flex-1 space-y-3 overflow-y-auto pr-1", compactSidebar && "space-y-1.5")}>
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
                              openThreadIds={openThreadIds}
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
                              openThreadIds={openThreadIds}
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
              {!groupedWorkspaces.length && !nanobotWorkspace && (
                <div className="px-2 py-4 text-xs text-muted-foreground">
                  {t("sidebar.empty")}
                </div>
              )}
            </div>
            <div className={cn("shrink-0 space-y-1", compactSidebar && "space-y-0.5")}>
              <SidebarGroup className="px-0">
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
                    compact={compactSidebar}
                  />
                </SidebarGroupContent>
              </SidebarGroup>
              <SidebarGroup className="px-0 group-data-[collapsible=icon]/sidebar-wrapper:hidden">
                <SidebarGroupLabel className="px-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {t("sidebar.nanobot.title")}
                </SidebarGroupLabel>
                <SidebarGroupContent className="space-y-1 px-2 pb-0">
                  {nanobotWorkspace && (
                    <div className="px-0">
                      <SidebarMenu>
                        <SidebarMenuItem>
                          <SidebarMenuButton
                            asChild
                            isActive={nanobotWorkspace.id === activeWorkspaceId}
                            onClick={() => onSelectWorkspace(nanobotWorkspace.id)}
                            className={cn(
                              "h-9 rounded-md px-2 text-sm",
                              "bg-sidebar-accent/10",
                              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                              "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
                            )}
                            data-tauri-drag-region="false"
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                onSelectWorkspace(nanobotWorkspace.id);
                              }
                            }}
                          >
                            <div
                              role="button"
                              tabIndex={0}
                              className="flex min-w-0 flex-1 items-center gap-2"
                            >
                              <Bot className="h-4 w-4 text-muted-foreground" aria-hidden />
                              <span className="min-w-0 flex-1 truncate font-medium">
                                {t("sidebar.nanobot.workspaceName")}
                              </span>
                              <span
                                className={cn(
                                  "h-2 w-2 rounded-full",
                                  nanobotWorkspace.connected
                                    ? "bg-emerald-500"
                                    : "bg-muted-foreground/40",
                                )}
                                aria-hidden
                              />
                              <button
                                type="button"
                                className={cn(
                                  "text-muted-foreground cursor-pointer transition-all",
                                  !nanobotIsCollapsed && "rotate-180",
                                )}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onToggleWorkspaceCollapse(
                                    nanobotWorkspace.id,
                                    !nanobotIsCollapsed,
                                  );
                                }}
                                data-tauri-drag-region="false"
                                aria-label={
                                  nanobotIsCollapsed
                                    ? t("sidebar.nanobot.expandThreads")
                                    : t("sidebar.nanobot.collapseThreads")
                                }
                                aria-expanded={!nanobotIsCollapsed}
                              >
                                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            </div>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      </SidebarMenu>
                      {!nanobotIsCollapsed &&
                        (nanobotThreads.length > 0 || Boolean(nanobotNextCursor)) && (
                          <ThreadList
                            workspaceId={nanobotWorkspace.id}
                            openThreadIds={openThreadIds}
                            pinnedRows={[]}
                            unpinnedRows={nanobotThreadRows.unpinnedRows}
                            totalThreadRoots={nanobotThreadRows.totalRoots}
                            isExpanded={nanobotIsExpanded}
                            nextCursor={nanobotNextCursor}
                            isPaging={nanobotIsPaging}
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
                    </div>
                  )}
                  <NanobotStatusCard
                    enabled={nanobotStatus.enabled}
                    running={nanobotStatus.running}
                    connected={nanobotStatus.connected}
                    reason={nanobotStatus.reason}
                    bluetoothEnabled={resolvedNanobotPresence.bluetoothEnabled}
                    bluetoothSupported={resolvedNanobotPresence.bluetoothSupported}
                    bluetoothScanning={resolvedNanobotPresence.bluetoothScanning}
                    bluetoothNearby={resolvedNanobotPresence.bluetoothNearby}
                    statusLabel={nanobotConnectionStatus}
                    modeValue={nanobotModeValue}
                    channelValue={nanobotChannelValue}
                    runtimeValue={nanobotRuntimeValue}
                    lastEventValue={nanobotLastEventValue}
                    modeTooltip={t("sidebar.nanobot.mode", { value: nanobotModeValue })}
                    channelTooltip={t("sidebar.nanobot.channel", { value: nanobotChannelValue })}
                    runtimeTooltip={t("sidebar.nanobot.state", { value: nanobotRuntimeValue })}
                    lastEventTooltip={t("sidebar.nanobot.lastEvent", {
                      value: nanobotLastEventValue,
                    })}
                    statusTooltip={t("sidebar.nanobot.connection", {
                      value: nanobotConnectionStatus,
                    })}
                    reasonLabel={t("sidebar.nanobot.reason")}
                    bluetoothLabel={nanobotBluetoothLabel}
                    nearbyLabel={nanobotNearbyLabel}
                    onOpenLog={onOpenNanobotLog}
                    compact={compactSidebar}
                  />
                </SidebarGroupContent>
              </SidebarGroup>
              {experimentalYunyiEnabled && (
                <SidebarGroup className="px-0 group-data-[collapsible=icon]/sidebar-wrapper:hidden">
                  <SidebarGroupLabel className="px-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {t("sidebar.yunyi.title")}
                  </SidebarGroupLabel>
                  <SidebarGroupContent className="px-2 pb-0">
                    <YunyiQuotaCard token={experimentalYunyiToken} compact={compactSidebar} />
                  </SidebarGroupContent>
                </SidebarGroup>
              )}
            </div>
          </div>
        </SidebarContent>
        <ShadcnSidebarFooter className={cn("px-2 pb-3", compactSidebar && "pb-2 pt-1")}>
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
            onOpenNanobotLog={onOpenNanobotLog}
            showNanobotLogButton
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
                      setAppearanceWorkspaceId(contextMenu.workspaceId);
                      closeContextMenu();
                    }}
                  >
                    {t("sidebar.menu.appearance")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
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
                      setAppearanceWorkspaceId(contextMenu.workspaceId);
                      closeContextMenu();
                    }}
                  >
                    {t("sidebar.menu.appearance")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
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
      <WorkspaceAppearanceDialog
        open={Boolean(appearanceWorkspace)}
        workspaceName={appearanceWorkspace?.name ?? ""}
        settings={appearanceWorkspace?.settings ?? null}
        onOpenChange={(open) => {
          if (!open) {
            setAppearanceWorkspaceId(null);
          }
        }}
        onSave={async (patch) => {
          if (!appearanceWorkspace) {
            return;
          }
          await onUpdateWorkspaceSettings(appearanceWorkspace.id, patch);
        }}
      />
      <SidebarRail />
    </ShadcnSidebar>
  );
}
