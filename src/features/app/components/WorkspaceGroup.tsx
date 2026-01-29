import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from "@/components/ui/sidebar";

type WorkspaceGroupProps = {
  toggleId: string | null;
  name: string;
  showHeader: boolean;
  isCollapsed: boolean;
  onToggleCollapse: (groupId: string) => void;
  children: React.ReactNode;
};

export function WorkspaceGroup({
  toggleId,
  name,
  showHeader,
  isCollapsed,
  onToggleCollapse,
  children,
}: WorkspaceGroupProps) {
  const isToggleable = Boolean(toggleId);
  const label = (
    <SidebarGroupLabel
      asChild
      className="px-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
    >
      {isToggleable ? (
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2"
          onClick={() => {
            if (!toggleId) {
              return;
            }
            onToggleCollapse(toggleId);
          }}
          aria-label={isCollapsed ? "Expand group" : "Collapse group"}
          aria-expanded={!isCollapsed}
        >
          <span className="truncate">{name}</span>
          <ChevronDown
            className={cn(
              "h-3 w-3 text-[var(--text-faint)] transition-transform",
              !isCollapsed && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      ) : (
        <div className="flex w-full items-center">
          <span className="truncate">{name}</span>
        </div>
      )}
    </SidebarGroupLabel>
  );

  return (
    <SidebarGroup className="gap-1 px-0 py-1">
      {showHeader && label}
      <SidebarGroupContent hidden={isCollapsed} aria-hidden={isCollapsed}>
        <SidebarMenu className="gap-2">{children}</SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
