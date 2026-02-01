import { useCallback, type MouseEvent } from "react";
import { Menu, MenuItem } from "@tauri-apps/api/menu";
import { LogicalPosition } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useI18n } from "../../../i18n";

type SidebarMenuHandlers = {
  onDeleteThread: (workspaceId: string, threadId: string) => void;
  onSyncThread: (workspaceId: string, threadId: string) => void;
  onPinThread: (workspaceId: string, threadId: string) => void;
  onUnpinThread: (workspaceId: string, threadId: string) => void;
  isThreadPinned: (workspaceId: string, threadId: string) => boolean;
  onRenameThread: (workspaceId: string, threadId: string) => void;
  onReloadWorkspaceThreads: (workspaceId: string) => void;
  onDeleteWorkspace: (workspaceId: string) => void;
  onDeleteWorktree: (workspaceId: string) => void;
};

export function useSidebarMenus({
  onDeleteThread,
  onSyncThread,
  onPinThread,
  onUnpinThread,
  isThreadPinned,
  onRenameThread,
  onReloadWorkspaceThreads,
  onDeleteWorkspace,
  onDeleteWorktree,
}: SidebarMenuHandlers) {
  const { t } = useI18n();
  const showThreadMenu = useCallback(
    async (
      event: MouseEvent,
      workspaceId: string,
      threadId: string,
      canPin: boolean,
    ) => {
      event.preventDefault();
      event.stopPropagation();
      const renameItem = await MenuItem.new({
        text: t("sidebar.menu.rename"),
        action: () => onRenameThread(workspaceId, threadId),
      });
      const syncItem = await MenuItem.new({
        text: t("sidebar.menu.sync"),
        action: () => onSyncThread(workspaceId, threadId),
      });
      const archiveItem = await MenuItem.new({
        text: t("sidebar.menu.archive"),
        action: () => onDeleteThread(workspaceId, threadId),
      });
      const copyItem = await MenuItem.new({
        text: t("sidebar.menu.copyId"),
        action: async () => {
          try {
            await navigator.clipboard.writeText(threadId);
          } catch {
            // Clipboard failures are non-fatal here.
          }
        },
      });
      const items = [renameItem, syncItem];
      if (canPin) {
        const isPinned = isThreadPinned(workspaceId, threadId);
        items.push(
          await MenuItem.new({
            text: isPinned ? t("sidebar.menu.unpin") : t("sidebar.menu.pin"),
            action: () => {
              if (isPinned) {
                onUnpinThread(workspaceId, threadId);
              } else {
                onPinThread(workspaceId, threadId);
              }
            },
          }),
        );
      }
      items.push(copyItem, archiveItem);
      const menu = await Menu.new({ items });
      const window = getCurrentWindow();
      const position = new LogicalPosition(event.clientX, event.clientY);
      await menu.popup(position, window);
    },
    [
      isThreadPinned,
      onDeleteThread,
      onPinThread,
      onRenameThread,
      onSyncThread,
      onUnpinThread,
      t,
    ],
  );

  const showWorkspaceMenu = useCallback(
    async (event: MouseEvent, workspaceId: string) => {
      event.preventDefault();
      event.stopPropagation();
      const reloadItem = await MenuItem.new({
        text: t("sidebar.menu.reloadThreads"),
        action: () => onReloadWorkspaceThreads(workspaceId),
      });
      const deleteItem = await MenuItem.new({
        text: t("sidebar.menu.delete"),
        action: () => onDeleteWorkspace(workspaceId),
      });
      const menu = await Menu.new({ items: [reloadItem, deleteItem] });
      const window = getCurrentWindow();
      const position = new LogicalPosition(event.clientX, event.clientY);
      await menu.popup(position, window);
    },
    [onReloadWorkspaceThreads, onDeleteWorkspace, t],
  );

  const showWorktreeMenu = useCallback(
    async (event: MouseEvent, workspaceId: string) => {
      event.preventDefault();
      event.stopPropagation();
      const reloadItem = await MenuItem.new({
        text: t("sidebar.menu.reloadThreads"),
        action: () => onReloadWorkspaceThreads(workspaceId),
      });
      const deleteItem = await MenuItem.new({
        text: t("sidebar.menu.deleteWorktree"),
        action: () => onDeleteWorktree(workspaceId),
      });
      const menu = await Menu.new({ items: [reloadItem, deleteItem] });
      const window = getCurrentWindow();
      const position = new LogicalPosition(event.clientX, event.clientY);
      await menu.popup(position, window);
    },
    [onReloadWorkspaceThreads, onDeleteWorktree, t],
  );

  return { showThreadMenu, showWorkspaceMenu, showWorktreeMenu };
}
