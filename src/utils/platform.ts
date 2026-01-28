type PlatformKind = "macos" | "windows" | "linux" | "unknown";

function readNavigatorPlatform(): string {
  if (typeof navigator === "undefined") {
    return "";
  }
  return (
    (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform ??
    navigator.platform ??
    ""
  );
}

export function getPlatformKind(): PlatformKind {
  const normalized = readNavigatorPlatform().toLowerCase();
  if (normalized.includes("mac")) {
    return "macos";
  }
  if (normalized.includes("win")) {
    return "windows";
  }
  if (normalized.includes("linux")) {
    return "linux";
  }
  return "unknown";
}

export function getFileManagerLabel(): string {
  const platform = getPlatformKind();
  if (platform === "macos") {
    return "Finder";
  }
  if (platform === "windows") {
    return "File Explorer";
  }
  return "File Manager";
}

export function getRevealInFileManagerLabel(): string {
  const platform = getPlatformKind();
  if (platform === "windows") {
    return "Show in File Explorer";
  }
  return `Reveal in ${getFileManagerLabel()}`;
}

export function getOpenInFileManagerLabel(): string {
  return `Open in ${getFileManagerLabel()}`;
}
