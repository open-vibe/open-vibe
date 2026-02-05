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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type WorktreePromptProps = {
  workspaceName: string;
  branch: string;
  setupScript: string;
  scriptError?: string | null;
  error?: string | null;
  onChange: (value: string) => void;
  onSetupScriptChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  isBusy?: boolean;
  isSavingScript?: boolean;
};

export function WorktreePrompt({
  workspaceName,
  branch,
  setupScript,
  scriptError = null,
  error = null,
  onChange,
  onSetupScriptChange,
  onCancel,
  onConfirm,
  isBusy = false,
  isSavingScript = false,
}: WorktreePromptProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

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
            if (!isBusy && branch.trim().length > 0) {
              onConfirm();
            }
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>{t("worktree.prompt.title")}</DialogTitle>
            <DialogDescription>
              {t("worktree.prompt.subtitle", { name: workspaceName })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="worktree-branch">
              {t("worktree.prompt.branch.label")}
            </Label>
            <Input
              id="worktree-branch"
              ref={inputRef}
              value={branch}
              onChange={(event) => onChange(event.target.value)}
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
          <Separator />
          <div className="space-y-2">
            <div className="text-sm font-medium">
              {t("worktree.prompt.script.title")}
            </div>
            <div className="text-sm text-muted-foreground">
              {t("worktree.prompt.script.hint")}
            </div>
            <Textarea
              id="worktree-setup-script"
              value={setupScript}
              onChange={(event) => onSetupScriptChange(event.target.value)}
              placeholder={t("worktree.prompt.script.placeholder")}
              rows={4}
              disabled={isBusy || isSavingScript}
            />
          </div>
          {scriptError && (
            <div className="text-sm text-destructive">{scriptError}</div>
          )}
          {error && <div className="text-sm text-destructive">{error}</div>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={onCancel} disabled={isBusy}>
                {t("worktree.prompt.cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={isBusy || branch.trim().length === 0}
            >
              {t("worktree.prompt.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
