import FolderKanban from "lucide-react/dist/esm/icons/folder-kanban";
import Plus from "lucide-react/dist/esm/icons/plus";

import {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type SidebarHeaderProps = {
  onSelectHome: () => void;
  onAddWorkspace: () => void;
};

export function SidebarHeader({ onSelectHome, onAddWorkspace }: SidebarHeaderProps) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={onSelectHome}
          data-tauri-drag-region="false"
          className="h-9 font-medium"
        >
          <FolderKanban className="h-4 w-4" aria-hidden />
          <span>Projects</span>
        </SidebarMenuButton>
        <SidebarMenuAction
          onClick={onAddWorkspace}
          data-tauri-drag-region="false"
          aria-label="Add workspace"
          showOnHover
        >
          <Plus className="h-4 w-4" aria-hidden />
        </SidebarMenuAction>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
