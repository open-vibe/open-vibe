import { X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { ThreadTab } from "../hooks/useThreadTabs";

type ThreadTabsBarProps = {
  tabs: ThreadTab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onReorderTab: (tabId: string, targetId: string) => void;
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
      <Tabs
        value={activeTabId ?? ""}
        onValueChange={(value) => {
          if (value) {
            onSelectTab(value);
          }
        }}
        className="w-full"
      >
        <TabsList className="thread-tabs-list">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
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
                "group/thread-tab flex max-w-[200px] items-center gap-2 rounded-none border-b-2 border-transparent",
                "bg-transparent px-3 py-1 text-xs font-medium text-muted-foreground shadow-none",
                "data-[state=active]:border-foreground/70 data-[state=active]:text-foreground",
                "data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                "hover:text-foreground",
                "cursor-pointer",
              )}
              title={tab.title}
            >
              <span className="truncate">{tab.title}</span>
              <span
                role="button"
                aria-label={`Close ${tab.title}`}
                tabIndex={-1}
                data-tauri-drag-region="false"
                className={cn(
                  "ml-auto inline-flex h-5 w-5 items-center justify-center rounded-sm",
                  "opacity-0 transition-opacity group-hover:opacity-100",
                  "group-data-[state=active]/thread-tab:opacity-100",
                )}
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
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
