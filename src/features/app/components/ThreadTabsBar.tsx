import { createPortal } from "react-dom";
import { useRef, useState } from "react";
import { X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useI18n } from "../../../i18n";
import type { ThreadTab } from "../hooks/useThreadTabs";

type ThreadTabsBarProps = {
  tabs: ThreadTab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onReorderTab: (tabId: string, targetId: string) => void;
  onRenameThread: (workspaceId: string, threadId: string) => void;
  onCloseOtherTabs: (tabId: string) => void;
  onCloseTabsToLeft: (tabId: string) => void;
  onCloseTabsToRight: (tabId: string) => void;
  onCloseAllTabs: () => void;
  onOpenInWindow: (tabId: string) => void;
};

const MAX_TITLE_LENGTH = 20;

const getDisplayTitle = (title: string) => {
  if (title.length <= MAX_TITLE_LENGTH) {
    return title;
  }
  return `${title.slice(0, MAX_TITLE_LENGTH)}…`;
};

export function ThreadTabsBar({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onReorderTab,
  onRenameThread,
  onCloseOtherTabs,
  onCloseTabsToLeft,
  onCloseTabsToRight,
  onCloseAllTabs,
  onOpenInWindow,
}: ThreadTabsBarProps) {
  const { t } = useI18n();
  const tabsListRef = useRef<HTMLDivElement | null>(null);
  const [contextTabId, setContextTabId] = useState<string | null>(null);
  const [contextPosition, setContextPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  if (tabs.length === 0) {
    return null;
  }
  const contextTab = contextTabId
    ? tabs.find((tab) => tab.id === contextTabId) ?? null
    : null;
  const contextIndex = contextTab ? tabs.findIndex((tab) => tab.id === contextTab.id) : -1;
  const canCloseLeft = contextIndex > 0;
  const canCloseRight = contextIndex >= 0 && contextIndex < tabs.length - 1;
  const canCloseOthers = tabs.length > 1;

  return (
    <div className="thread-tabs-bar" data-tauri-drag-region="false">
      <div
        className="thread-tabs-list"
        role="tablist"
        aria-orientation="horizontal"
        ref={tabsListRef}
        onWheel={(event) => {
          if (Math.abs(event.deltaY) < 0.5) {
            return;
          }
          const list = tabsListRef.current;
          if (!list || list.scrollWidth <= list.clientWidth) {
            return;
          }
          list.scrollLeft += event.deltaY;
          event.preventDefault();
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const displayTitle = getDisplayTitle(tab.title);
          return (
            <div
              key={tab.id}
              role="presentation"
              draggable
              data-tauri-drag-region="false"
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", tab.id);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                event.preventDefault();
                const sourceId = event.dataTransfer.getData("text/plain");
                if (!sourceId || sourceId === tab.id) {
                  return;
                }
                onReorderTab(sourceId, tab.id);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setContextTabId(tab.id);
                setContextPosition({ x: event.clientX, y: event.clientY });
              }}
              className={cn(
                "thread-tab-item",
                isActive && "is-active",
              )}
              title={tab.title}
            >
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`thread-tab-panel-${tab.id}`}
                className="thread-tab-button"
                onClick={() => onSelectTab(tab.id)}
                onDoubleClick={() => {
                  if (tab.kind !== "thread") {
                    return;
                  }
                  onRenameThread(tab.workspaceId, tab.threadId);
                }}
                data-tauri-drag-region="false"
              >
                <span className="thread-tab-title">{displayTitle}</span>
              </button>
              <span
                role="button"
                aria-label={`Close ${tab.title}`}
                tabIndex={-1}
                data-tauri-drag-region="false"
                className="thread-tab-close"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onCloseTab(tab.id);
                }}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                <X className="h-3 w-3" />
              </span>
            </div>
          );
        })}
      </div>
      {contextTab && contextPosition
        ? createPortal(
            <DropdownMenu
              open
              onOpenChange={(open) => {
                if (!open) {
                  setContextTabId(null);
                  setContextPosition(null);
                }
              }}
            >
              <DropdownMenuTrigger asChild>
                <div
                  style={{
                    position: "fixed",
                    left: contextPosition.x,
                    top: contextPosition.y,
                    width: 1,
                    height: 1,
                  }}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent sideOffset={6} align="start" className="w-52">
                {contextTab.kind === "thread" ? (
                  <>
                    <DropdownMenuItem
                      onSelect={() => {
                        onOpenInWindow(contextTab.id);
                        setContextTabId(null);
                        setContextPosition(null);
                      }}
                    >
                      {t("threadTabs.menu.openInWindow")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                ) : null}
                <DropdownMenuItem
                  onSelect={() => {
                    onCloseTab(contextTab.id);
                    setContextTabId(null);
                    setContextPosition(null);
                  }}
                >
                  {t("threadTabs.menu.close")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canCloseOthers}
                  onSelect={() => {
                    onCloseOtherTabs(contextTab.id);
                    setContextTabId(null);
                    setContextPosition(null);
                  }}
                >
                  {t("threadTabs.menu.closeOthers")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canCloseLeft}
                  onSelect={() => {
                    onCloseTabsToLeft(contextTab.id);
                    setContextTabId(null);
                    setContextPosition(null);
                  }}
                >
                  {t("threadTabs.menu.closeLeft")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canCloseRight}
                  onSelect={() => {
                    onCloseTabsToRight(contextTab.id);
                    setContextTabId(null);
                    setContextPosition(null);
                  }}
                >
                  {t("threadTabs.menu.closeRight")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {contextTab.kind === "thread" ? (
                  <DropdownMenuItem
                    onSelect={() => {
                      onRenameThread(contextTab.workspaceId, contextTab.threadId);
                      setContextTabId(null);
                      setContextPosition(null);
                    }}
                  >
                    {t("threadTabs.menu.rename")}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  disabled={tabs.length === 0}
                  onSelect={() => {
                    onCloseAllTabs();
                    setContextTabId(null);
                    setContextPosition(null);
                  }}
                >
                  {t("threadTabs.menu.closeAll")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>,
            document.body,
          )
        : null}
    </div>
  );
}
