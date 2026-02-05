import { useEffect, useRef } from "react";
import { useI18n } from "../../../i18n";

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
    <div className="clone-modal" role="dialog" aria-modal="true">
      <div
        className="clone-modal-backdrop"
        onClick={() => {
          if (!isBusy) {
            onCancel();
          }
        }}
      />
      <div className="clone-modal-card">
        <div className="clone-modal-title">{t("clone.prompt.title")}</div>
        <div className="clone-modal-subtitle">
          {t("clone.prompt.subtitle", { name: workspaceName })}
        </div>
        <label className="clone-modal-label" htmlFor="clone-copy-name">
          {t("clone.prompt.copyName.label")}
        </label>
        <input
          id="clone-copy-name"
          ref={inputRef}
          className="clone-modal-input"
          value={copyName}
          onChange={(event) => onCopyNameChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              if (!isBusy) {
                onCancel();
              }
            }
            if (event.key === "Enter" && canCreate && !isBusy) {
              event.preventDefault();
              onConfirm();
            }
          }}
        />
        <label className="clone-modal-label" htmlFor="clone-copies-folder">
          {t("clone.prompt.copiesFolder.label")}
        </label>
        <div className="clone-modal-folder-row">
          <textarea
            id="clone-copies-folder"
            className="clone-modal-input clone-modal-input--path"
            value={copiesFolder}
            placeholder={t("clone.prompt.copiesFolder.placeholder")}
            readOnly
            rows={1}
            wrap="off"
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
              if (event.key === "Enter" && canCreate && !isBusy) {
                event.preventDefault();
                onConfirm();
              }
            }}
          ></textarea>
          <button
            type="button"
            className="ghost clone-modal-button"
            onClick={onChooseCopiesFolder}
            disabled={isBusy}
          >
            {t("clone.prompt.choose")}
          </button>
          <button
            type="button"
            className="ghost clone-modal-button"
            onClick={onClearCopiesFolder}
            disabled={isBusy || copiesFolder.trim().length === 0}
          >
            {t("clone.prompt.clear")}
          </button>
        </div>
        {showSuggested && (
          <div className="clone-modal-suggested">
            <div className="clone-modal-suggested-label">
              {t("clone.prompt.suggested")}
            </div>
            <div className="clone-modal-suggested-row">
              <textarea
                className="clone-modal-suggested-path clone-modal-input--path"
                value={suggestedCopiesFolder ?? ""}
                readOnly
                rows={1}
                wrap="off"
                aria-label={t("clone.prompt.suggested.aria")}
                title={suggestedCopiesFolder ?? ""}
                onFocus={(event) => {
                  const value = event.currentTarget.value;
                  event.currentTarget.setSelectionRange(value.length, value.length);
                  requestAnimationFrame(() => {
                    event.currentTarget.scrollLeft = event.currentTarget.scrollWidth;
                  });
                }}
              ></textarea>
              <button
                type="button"
                className="ghost clone-modal-button"
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
              </button>
              <button
                type="button"
                className="ghost clone-modal-button"
                onClick={onUseSuggestedCopiesFolder}
                disabled={isBusy}
              >
                {t("clone.prompt.useSuggested")}
              </button>
            </div>
          </div>
        )}
        {error && <div className="clone-modal-error">{error}</div>}
        <div className="clone-modal-actions">
          <button
            className="ghost clone-modal-button"
            onClick={onCancel}
            type="button"
            disabled={isBusy}
          >
            {t("clone.prompt.cancel")}
          </button>
          <button
            className="primary clone-modal-button"
            onClick={onConfirm}
            type="button"
            disabled={isBusy || !canCreate}
          >
            {t("clone.prompt.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
