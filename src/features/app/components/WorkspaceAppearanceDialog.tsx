import { useEffect, useState } from "react";
import { useI18n } from "../../../i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  WORKSPACE_COLOR_OPTIONS,
  WORKSPACE_ICON_OPTIONS,
  type WorkspaceIconName,
} from "./WorkspaceGlyph";
import type { WorkspaceSettings } from "../../../types";
import { cn } from "@/lib/utils";
import { EmojiMartPicker } from "./EmojiMartPicker";

type WorkspaceAppearanceDialogProps = {
  open: boolean;
  workspaceName: string;
  settings: WorkspaceSettings | null;
  onOpenChange: (open: boolean) => void;
  onSave: (patch: Partial<WorkspaceSettings>) => Promise<void>;
};

function normalizeEmoji(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "";
  }
  return Array.from(trimmed).slice(0, 2).join("");
}

function normalizeIcon(value: string | null | undefined): WorkspaceIconName | "" {
  if (!value) {
    return "";
  }
  const candidate = value.trim() as WorkspaceIconName;
  return WORKSPACE_ICON_OPTIONS.some((item) => item.value === candidate)
    ? candidate
    : "";
}

function normalizeColor(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "";
  }
  const hex = trimmed.match(/^#?([0-9a-f]{6})$/i);
  if (hex) {
    return `#${hex[1].toUpperCase()}`;
  }
  return trimmed;
}

export function WorkspaceAppearanceDialog({
  open,
  workspaceName,
  settings,
  onOpenChange,
  onSave,
}: WorkspaceAppearanceDialogProps) {
  const { t } = useI18n();
  const [emoji, setEmoji] = useState("");
  const [icon, setIcon] = useState<WorkspaceIconName | "">("");
  const [color, setColor] = useState("");
  const [emojiPopoverOpen, setEmojiPopoverOpen] = useState(false);
  const [colorPopoverOpen, setColorPopoverOpen] = useState(false);
  const [customColorDraft, setCustomColorDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setEmoji(normalizeEmoji(settings?.workspaceEmoji));
    setIcon(normalizeIcon(settings?.workspaceIcon));
    const normalized = normalizeColor(settings?.workspaceColor);
    setColor(normalized);
    setCustomColorDraft(normalized || "#3B82F6");
    setEmojiPopoverOpen(false);
    setColorPopoverOpen(false);
  }, [open, settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        workspaceEmoji: emoji.trim() ? normalizeEmoji(emoji) : null,
        workspaceIcon: icon || null,
        workspaceColor: color.trim() || null,
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("sidebar.appearance.title")}</DialogTitle>
          <DialogDescription>
            {t("sidebar.appearance.description", { name: workspaceName })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("sidebar.appearance.emoji.label")}</Label>
            <div className="flex items-center gap-2">
              <Popover open={emojiPopoverOpen} onOpenChange={setEmojiPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex h-9 min-w-28 items-center justify-center rounded-md border border-border bg-background px-3 text-base transition-colors hover:bg-accent hover:text-accent-foreground",
                      !emoji && "text-muted-foreground",
                    )}
                  >
                    {emoji || t("sidebar.appearance.emoji.none")}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="bottom"
                  className="w-auto overflow-hidden p-0"
                >
                  <EmojiMartPicker
                    onSelect={(value) => {
                      setEmoji(normalizeEmoji(value));
                      setEmojiPopoverOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!emoji}
                onClick={() => setEmoji("")}
              >
                {t("sidebar.appearance.emoji.clear")}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("sidebar.appearance.icon.label")}</Label>
            <div className="grid grid-cols-5 gap-2">
              {WORKSPACE_ICON_OPTIONS.map(({ value, Icon }) => (
                <button
                  key={value}
                  type="button"
                  className={cn(
                    "inline-flex h-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                    icon === value && "border-primary bg-primary/10 text-foreground",
                  )}
                  onClick={() => setIcon((current) => (current === value ? "" : value))}
                  aria-label={value}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("sidebar.appearance.color.label")}</Label>
            <div className="flex items-center gap-2">
              <Popover open={colorPopoverOpen} onOpenChange={setColorPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 min-w-40 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <span
                      className="h-4 w-4 rounded-sm border border-border/70"
                      style={{
                        backgroundColor: color || "transparent",
                      }}
                    />
                    <span className={cn(!color && "text-muted-foreground")}>
                      {color || t("sidebar.appearance.color.none")}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="bottom"
                  className="w-[292px] p-3"
                >
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-2">
                      {WORKSPACE_COLOR_OPTIONS.map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={cn(
                            "h-10 rounded-md border border-border/60 transition-transform hover:scale-105",
                            color === option && "ring-2 ring-primary ring-offset-2",
                          )}
                          style={{ backgroundColor: option }}
                          onClick={() => {
                            setColor(option);
                            setCustomColorDraft(option);
                            setColorPopoverOpen(false);
                          }}
                          aria-label={option}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                      <Input
                        type="color"
                        value={
                          customColorDraft.match(/^#([0-9a-f]{6})$/i)
                            ? customColorDraft
                            : "#3B82F6"
                        }
                        onChange={(event) => {
                          const next = normalizeColor(event.target.value);
                          setCustomColorDraft(next);
                          setColor(next);
                        }}
                        className="h-9 w-12 p-1"
                        aria-label={t("sidebar.appearance.color.customLabel")}
                      />
                      <Input
                        value={customColorDraft}
                        placeholder="#3B82F6"
                        onChange={(event) => {
                          const next = event.target.value;
                          setCustomColorDraft(next);
                          const normalized = normalizeColor(next);
                          if (normalized.match(/^#([0-9A-F]{6})$/)) {
                            setColor(normalized);
                          }
                        }}
                        aria-label={t("sidebar.appearance.color.customLabel")}
                      />
                    </div>
                    <div className="flex justify-between gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setColor("");
                          setCustomColorDraft("#3B82F6");
                          setColorPopoverOpen(false);
                        }}
                      >
                        {t("sidebar.appearance.color.reset")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          const normalized = normalizeColor(customColorDraft);
                          if (normalized.match(/^#([0-9A-F]{6})$/)) {
                            setColor(normalized);
                            setColorPopoverOpen(false);
                          }
                        }}
                      >
                        {t("sidebar.appearance.color.custom")}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!color}
                  onClick={() => setColor("")}
                >
                  {t("sidebar.appearance.color.reset")}
                </Button>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("settings.action.cancel")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? t("settings.action.saving") : t("settings.action.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
