# Open Vibe

<div align="center">
  <img src="screenshot.png" alt="Open Vibe" width="920" />
  <h1>Open Vibe: Multi-Agent Desktop Workspace</h1>
  <p>
    <a href="https://github.com/open-vibe/open-vibe"><img src="https://img.shields.io/badge/OpenVibe-Desktop-111827" alt="OpenVibe"></a>
    <img src="https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white" alt="Tauri">
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111827" alt="React">
    <img src="https://img.shields.io/badge/Rust-stable-000000?logo=rust&logoColor=white" alt="Rust">
    <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-4C8BF5" alt="Platform">
    <img src="https://img.shields.io/badge/License-MIT-22C55E" alt="License">
    <a href="https://github.com/open-vibe/nanobot-rs"><img src="https://img.shields.io/badge/Nanobot-Integrated-16A34A" alt="Nanobot"></a>
  </p>
</div>

中文版本: [README.zh-CN.md](README.zh-CN.md)

> **nanobot is an ultra-lightweight personal AI assistant inspired by [Clawdbot](https://github.com/openclaw/openclaw).**
>
> Open Vibe now integrates the Rust implementation: **[open-vibe/nanobot-rs](https://github.com/open-vibe/nanobot-rs)**.

## ✨ Why Open Vibe

- 🚀 **Multi-agent orchestration** across local workspaces, worktrees, and clones.
- 🧠 **Codex app-server native flow**: threads, approvals, resume, streaming events.
- 🤝 **Bridge channels**: Happy mobile relay + Nanobot DingTalk relay commands.
- 🗂️ **Thread tabs + fast context switching** with persisted per-tab state.
- 🛠️ **Deep Git/GitHub tooling**: status, diffs, logs, branches, PR context workflows.
- 🎛️ **Power-user desktop UX**: resizable panes, terminal dock, theming, shortcuts, dictation.

## 🧩 Core Capabilities

### 🏢 Workspaces and Threads

- Persist and manage workspaces with grouping, sorting, and activity tracking.
- Start one `codex app-server` per workspace; list/resume/archive threads.
- Pin, rename, and organize threads with unread and running state indicators.
- Worktree and clone workflows for isolated development lanes.

### 💬 Composer and Agent Controls

- Rich composer with image picker, drag/drop, paste, and queued send.
- Autocomplete for skills (`$`), prompts (`/prompts:`), review (`/review`), and paths (`@`).
- Model, reasoning, access mode, and collaboration controls in one place.
- Approval handling and full thread item rendering (messages, tools, reasoning, diffs).

### 🔗 Nanobot + DingTalk (Bridge)

- Bridge mode routes DingTalk inbound messages into Open Vibe threads.
- Default route target: current workspace.
- Relay control commands supported in chat:
  - `/menu`
  - `/mode bridge`
  - `/mode agent`
  - `/relay`
  - `/relay <number>`

## 🏗️ Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Desktop Runtime:** Tauri 2
- **Backend:** Rust (Tokio async runtime)
- **Protocol:** Codex app-server JSON-RPC over stdio
- **Bridge Runtime:** Happy bridge + Nanobot bridge daemon

## ⚙️ Requirements

- Node.js + npm
- Rust toolchain (stable)
- CMake (native deps; used by dictation on non-Windows)
- `codex` available in `PATH` (or configure path in Settings)
- Git CLI (required)
- GitHub CLI `gh` (optional, for GitHub panel)

## 🚀 Quick Start

```bash
npm install
npm run tauri dev
```

## 📦 Build

```bash
npm run tauri build
```

Windows build (opt-in):

```bash
npm run tauri:build:win
```

## 🧪 Validation

```bash
npm run lint
npm run test
npm run typecheck
```

## 📁 Project Structure

```text
src/
  features/         feature-sliced UI + hooks
  services/         Tauri IPC wrappers + event hubs
  styles/           split CSS by area/theme
  types.ts          shared frontend types
src-tauri/
  src/lib.rs        Tauri backend composition root
  src/codex.rs      Codex app-server client logic
  src/nanobot_bridge.rs
  src/nanobot_bridge_daemon.rs
  src/happy_bridge.rs
```

## 📌 Notes

- Settings persist in app data `settings.json`; workspaces in `workspaces.json`.
- Thread restore is scoped by workspace `cwd` filtering.
- Selecting a thread triggers `thread/resume` refresh.
- Custom prompts are loaded from `$CODEX_HOME/prompts`.

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=open-vibe/open-vibe&type=date&legend=top-left)](https://www.star-history.com/#open-vibe/open-vibe&type=date&legend=top-left)
