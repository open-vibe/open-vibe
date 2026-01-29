import ScrollText from "lucide-react/dist/esm/icons/scroll-text";
import Settings from "lucide-react/dist/esm/icons/settings";
import { Button } from "@/components/ui/button";

type SidebarCornerActionsProps = {
  onOpenSettings: () => void;
  onOpenDebug: () => void;
  showDebugButton: boolean;
};

export function SidebarCornerActions({
  onOpenSettings,
  onOpenDebug,
  showDebugButton,
}: SidebarCornerActionsProps) {
  return (
    <div className="absolute bottom-3 left-3 flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon-xs"
        type="button"
        onClick={onOpenSettings}
        aria-label="Open settings"
        title="Settings"
      >
        <Settings size={14} aria-hidden />
      </Button>
      {showDebugButton && (
        <Button
          variant="ghost"
          size="icon-xs"
          type="button"
          onClick={onOpenDebug}
          aria-label="Open debug log"
          title="Debug log"
        >
          <ScrollText size={14} aria-hidden />
        </Button>
      )}
    </div>
  );
}
