import type { DebugEntry } from "../../../types";
import { useI18n } from "../../../i18n";

type LogTabPageProps = {
  title: string;
  emptyText: string;
  entries: DebugEntry[];
  onClear: () => void;
  onCopy: () => void;
};

function formatPayload(payload: unknown) {
  if (payload === undefined) {
    return "";
  }
  if (typeof payload === "string") {
    return payload;
  }
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

export function LogTabPage({
  title,
  emptyText,
  entries,
  onClear,
  onCopy,
}: LogTabPageProps) {
  const { t } = useI18n();
  return (
    <section className="log-tab-page">
      <header className="log-tab-header">
        <h2 className="log-tab-title">{title}</h2>
        <div className="log-tab-actions">
          <button className="ghost" onClick={onCopy}>
            {t("log.actions.copy")}
          </button>
          <button className="ghost" onClick={onClear}>
            {t("log.actions.clear")}
          </button>
        </div>
      </header>
      <div className="log-tab-list">
        {entries.length === 0 ? <div className="debug-empty">{emptyText}</div> : null}
        {entries.map((entry) => (
          <div key={entry.id} className="debug-row">
            <div className="debug-meta">
              <span className={`debug-source ${entry.source}`}>{entry.source}</span>
              <span className="debug-time">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
              <span className="debug-label">{entry.label}</span>
            </div>
            {entry.payload !== undefined ? (
              <pre className="debug-payload">{formatPayload(entry.payload)}</pre>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
