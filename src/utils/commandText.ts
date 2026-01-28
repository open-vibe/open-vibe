const BASH_SHELLS = new Set([
  "bash",
  "bash.exe",
  "zsh",
  "zsh.exe",
  "sh",
  "sh.exe",
  "fish",
  "fish.exe",
]);
const CMD_SHELLS = new Set(["cmd", "cmd.exe"]);
const POWERSHELLS = new Set(["powershell", "powershell.exe", "pwsh", "pwsh.exe"]);

function splitExecutable(commandText: string) {
  const match = commandText.match(
    /^(?:"([^"]+)"|'([^']+)'|(\S+))\s+([\s\S]+)$/,
  );
  if (!match) {
    return null;
  }
  const exec = match[1] ?? match[2] ?? match[3] ?? "";
  const args = match[4] ?? "";
  if (!exec || !args) {
    return null;
  }
  return { exec, args };
}

function normalizeExecutableName(exec: string) {
  return exec.split(/[\\/]/).pop()?.toLowerCase() ?? "";
}

function unwrapShellCommand(commandText: string) {
  const split = splitExecutable(commandText);
  if (!split) {
    return null;
  }
  const base = normalizeExecutableName(split.exec);
  const args = split.args.trim();

  if (BASH_SHELLS.has(base)) {
    const match = args.match(
      /(?:^|\s)-lc\s+(?:(['"])([\s\S]+)\1|([\s\S]+))$/i,
    );
    return match ? (match[2] ?? match[3] ?? "").trim() : null;
  }

  if (CMD_SHELLS.has(base)) {
    const match = args.match(
      /(?:^|\s)\/c\s+(?:(['"])([\s\S]+)\1|([\s\S]+))$/i,
    );
    return match ? (match[2] ?? match[3] ?? "").trim() : null;
  }

  if (POWERSHELLS.has(base)) {
    const match = args.match(
      /(?:^|\s)-(?:command|c)\s+(?:(['"])([\s\S]+)\1|([\s\S]+))$/i,
    );
    return match ? (match[2] ?? match[3] ?? "").trim() : null;
  }

  return null;
}

export function cleanCommandText(commandText: string) {
  if (!commandText) {
    return "";
  }
  const trimmed = commandText.trim();
  const inner = unwrapShellCommand(trimmed) ?? trimmed;
  const cdMatch = inner.match(
    /^\s*cd\s+[^&;]+(?:\s*&&\s*|\s*;\s*)([\s\S]+)$/i,
  );
  const stripped = cdMatch ? cdMatch[1] : inner;
  return stripped.trim();
}
