import type { ReactNode } from "react";

type MainTopbarProps = {
  leftNode: ReactNode;
  actionsNode?: ReactNode;
  tabsNode?: ReactNode;
  className?: string;
};

export function MainTopbar({
  leftNode,
  actionsNode,
  tabsNode,
  className,
}: MainTopbarProps) {
  const classNames = [
    "main-topbar",
    tabsNode ? "has-tabs" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classNames} data-tauri-drag-region>
      <div className="main-topbar-row">
        <div className="main-topbar-left">{leftNode}</div>
        <div className="actions">{actionsNode ?? null}</div>
      </div>
      {tabsNode ? <div className="main-topbar-tabs">{tabsNode}</div> : null}
    </div>
  );
}
