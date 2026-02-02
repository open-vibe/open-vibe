import type { AppSettings, OpenAppTarget } from "../../../types";
import { getPlatformKind } from "../../../utils/platform";
import { DEFAULT_OPEN_APP_ID } from "../constants";

type ResolvedLaunchTarget = {
  kind: OpenAppTarget["kind"];
  appName?: string | null;
  command?: string | null;
  args: string[];
};

const NON_MAC_APP_COMMANDS: Record<string, string> = {
  vscode: "code",
  cursor: "cursor",
  zed: "zed",
  ghostty: "ghostty",
  antigravity: "antigravity",
};

export function normalizeOpenAppTargets(targets: OpenAppTarget[]): OpenAppTarget[] {
  return targets
    .map((target) => ({
      ...target,
      label: target.label.trim(),
      appName: (target.appName?.trim() ?? "") || null,
      command: (target.command?.trim() ?? "") || null,
      args: Array.isArray(target.args) ? target.args.map((arg) => arg.trim()) : [],
    }))
    .filter((target) => target.label && target.id);
}

export function getOpenAppTargets(settings: AppSettings): OpenAppTarget[] {
  return normalizeOpenAppTargets(settings.openAppTargets ?? []);
}

export function getSelectedOpenAppId(settings: AppSettings): string {
  const targets = getOpenAppTargets(settings);
  const selected =
    settings.selectedOpenAppId ||
    (typeof window === "undefined"
      ? DEFAULT_OPEN_APP_ID
      : window.localStorage.getItem("open-workspace-app") || DEFAULT_OPEN_APP_ID);
  return targets.some((target) => target.id === selected)
    ? selected
    : targets[0]?.id ?? DEFAULT_OPEN_APP_ID;
}

export function resolveOpenAppLaunch(target: OpenAppTarget): ResolvedLaunchTarget {
  const args = Array.isArray(target.args) ? target.args : [];
  if (target.kind === "finder") {
    return { kind: "finder", args };
  }
  if (target.kind === "command") {
    return {
      kind: "command",
      command: target.command?.trim() || null,
      args,
    };
  }
  const platform = getPlatformKind();
  if (platform !== "macos") {
    const fallback =
      target.command?.trim() ||
      NON_MAC_APP_COMMANDS[target.id] ||
      target.appName?.trim() ||
      null;
    return {
      kind: "command",
      command: fallback,
      args,
    };
  }
  return {
    kind: "app",
    appName: target.appName?.trim() || target.label.trim() || null,
    args,
  };
}
