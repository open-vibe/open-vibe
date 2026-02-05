import { useEffect, useRef } from "react";
import { useI18n } from "../../../i18n";

type RenameThreadPromptProps = {
  currentName: string;
  name: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function RenameThreadPrompt({
  currentName,
  name,
  onChange,
  onCancel,
  onConfirm,
}: RenameThreadPromptProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div className="worktree-modal" role="dialog" aria-modal="true">
      <div className="worktree-modal-backdrop" onClick={onCancel} />
      <div className="worktree-modal-card">
        <div className="worktree-modal-title">{t("threads.rename.title")}</div>
        <div className="worktree-modal-subtitle">
          {t("threads.rename.subtitle", { name: currentName })}
        </div>
        <label className="worktree-modal-label" htmlFor="thread-rename">
          {t("threads.rename.label")}
        </label>
        <input
          id="thread-rename"
          ref={inputRef}
          className="worktree-modal-input"
          value={name}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
            if (event.key === "Enter") {
              event.preventDefault();
              onConfirm();
            }
          }}
        />
        <div className="worktree-modal-subtitle">
          {t("threads.rename.hint")}
        </div>
        <div className="worktree-modal-actions">
          <button
            className="ghost worktree-modal-button"
            onClick={onCancel}
            type="button"
          >
            {t("threads.rename.cancel")}
          </button>
          <button
            className="primary worktree-modal-button"
            onClick={onConfirm}
            type="button"
          >
            {t("threads.rename.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
