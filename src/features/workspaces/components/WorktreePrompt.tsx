import { useEffect, useRef } from "react";
import { useI18n } from "../../../i18n";

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
    <div className="worktree-modal" role="dialog" aria-modal="true">
      <div
        className="worktree-modal-backdrop"
        onClick={() => {
          if (!isBusy) {
            onCancel();
          }
        }}
      />
      <div className="worktree-modal-card">
        <div className="worktree-modal-title">
          {t("worktree.prompt.title")}
        </div>
        <div className="worktree-modal-subtitle">
          {t("worktree.prompt.subtitle", { name: workspaceName })}
        </div>
        <label className="worktree-modal-label" htmlFor="worktree-branch">
          {t("worktree.prompt.branch.label")}
        </label>
        <input
          id="worktree-branch"
          ref={inputRef}
          className="worktree-modal-input"
          value={branch}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              if (!isBusy) {
                onCancel();
              }
            }
            if (event.key === "Enter" && !isBusy) {
              event.preventDefault();
              onConfirm();
            }
          }}
        />
        <div className="worktree-modal-divider" />
        <div className="worktree-modal-section-title">
          {t("worktree.prompt.script.title")}
        </div>
        <div className="worktree-modal-hint">
          {t("worktree.prompt.script.hint")}
        </div>
        <textarea
          id="worktree-setup-script"
          className="worktree-modal-textarea"
          value={setupScript}
          onChange={(event) => onSetupScriptChange(event.target.value)}
          placeholder={t("worktree.prompt.script.placeholder")}
          rows={4}
          disabled={isBusy || isSavingScript}
        />
        {scriptError && <div className="worktree-modal-error">{scriptError}</div>}
        {error && <div className="worktree-modal-error">{error}</div>}
        <div className="worktree-modal-actions">
          <button
            className="ghost worktree-modal-button"
            onClick={onCancel}
            type="button"
            disabled={isBusy}
          >
            {t("worktree.prompt.cancel")}
          </button>
          <button
            className="primary worktree-modal-button"
            onClick={onConfirm}
            type="button"
            disabled={isBusy || branch.trim().length === 0}
          >
            {t("worktree.prompt.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
