import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ThreadTab } from "../hooks/useThreadTabs";

type ThreadTabsBarProps = {
  tabs: ThreadTab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onReorderTab: (tabId: string, targetId: string) => void;
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
}: ThreadTabsBarProps) {
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="thread-tabs-bar" data-tauri-drag-region="false">
      <div className="thread-tabs-list" role="tablist" aria-orientation="horizontal">
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
    </div>
  );
}
