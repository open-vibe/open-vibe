import { useEffect, useRef } from "react";
import { useI18n } from "../../../i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ClonePromptProps = {
  workspaceName: string;
  copyName: string;
  copiesFolder: string;
  suggestedCopiesFolder?: string | null;
  error?: string | null;
  onCopyNameChange: (value: string) => void;
  onChooseCopiesFolder: () => void;
  onUseSuggestedCopiesFolder: () => void;
  onClearCopiesFolder: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  isBusy?: boolean;
};

export function ClonePrompt({
  workspaceName,
  copyName,
  copiesFolder,
  suggestedCopiesFolder = null,
  error = null,
  onCopyNameChange,
  onChooseCopiesFolder,
  onUseSuggestedCopiesFolder,
  onClearCopiesFolder,
  onCancel,
  onConfirm,
  isBusy = false,
}: ClonePromptProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const canCreate = copyName.trim().length > 0 && copiesFolder.trim().length > 0;
  const showSuggested =
    Boolean(suggestedCopiesFolder) && copiesFolder.trim().length === 0;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isBusy) {
          onCancel();
        }
      }}
    >
      <DialogContent
        className="sm:max-w-lg"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
          inputRef.current?.select();
        }}
        onEscapeKeyDown={(event) => {
          if (isBusy) {
            event.preventDefault();
            return;
          }
          onCancel();
        }}
        onInteractOutside={(event) => {
          if (isBusy) {
            event.preventDefault();
          }
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canCreate && !isBusy) {
              onConfirm();
            }
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>{t("clone.prompt.title")}</DialogTitle>
            <DialogDescription>
              {t("clone.prompt.subtitle", { name: workspaceName })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="clone-copy-name">
              {t("clone.prompt.copyName.label")}
            </Label>
            <Input
              id="clone-copy-name"
              ref={inputRef}
              value={copyName}
              onChange={(event) => onCopyNameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  if (!isBusy) {
                    onCancel();
                  }
                }
              }}
              disabled={isBusy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clone-copies-folder">
              {t("clone.prompt.copiesFolder.label")}
            </Label>
            <div className="flex flex-wrap items-start gap-2">
              <Textarea
                id="clone-copies-folder"
                value={copiesFolder}
                placeholder={t("clone.prompt.copiesFolder.placeholder")}
                readOnly
                rows={1}
                wrap="off"
                className="min-h-[36px] flex-1 resize-none font-mono"
                onFocus={(event) => {
                  const value = event.currentTarget.value;
                  event.currentTarget.setSelectionRange(value.length, value.length);
                  requestAnimationFrame(() => {
                    event.currentTarget.scrollLeft = event.currentTarget.scrollWidth;
                  });
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    if (!isBusy) {
                      onCancel();
                    }
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onChooseCopiesFolder}
                disabled={isBusy}
              >
                {t("clone.prompt.choose")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClearCopiesFolder}
                disabled={isBusy || copiesFolder.trim().length === 0}
              >
                {t("clone.prompt.clear")}
              </Button>
            </div>
          </div>
          {showSuggested && (
            <div className="space-y-2 rounded-md border border-dashed border-border/60 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("clone.prompt.suggested")}
              </div>
              <div className="flex flex-wrap items-start gap-2">
                <Textarea
                  value={suggestedCopiesFolder ?? ""}
                  readOnly
                  rows={1}
                  wrap="off"
                  aria-label={t("clone.prompt.suggested.aria")}
                  title={suggestedCopiesFolder ?? ""}
                  className="min-h-[36px] flex-1 resize-none font-mono"
                  onFocus={(event) => {
                    const value = event.currentTarget.value;
                    event.currentTarget.setSelectionRange(value.length, value.length);
                    requestAnimationFrame(() => {
                      event.currentTarget.scrollLeft = event.currentTarget.scrollWidth;
                    });
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!suggestedCopiesFolder) {
                      return;
                    }
                    try {
                      await navigator.clipboard.writeText(suggestedCopiesFolder);
                    } catch {
                      // Ignore clipboard failures (e.g. permission denied).
                    }
                  }}
                  disabled={isBusy || !suggestedCopiesFolder}
                >
                  {t("clone.prompt.copy")}
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={onUseSuggestedCopiesFolder}
                  disabled={isBusy}
                >
                  {t("clone.prompt.useSuggested")}
                </Button>
              </div>
            </div>
          )}
          {error && <div className="text-sm text-destructive">{error}</div>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={onCancel} disabled={isBusy}>
                {t("clone.prompt.cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isBusy || !canCreate}>
              {t("clone.prompt.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
