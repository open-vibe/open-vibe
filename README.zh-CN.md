# Open Vibe

![Open Vibe](screenshot.png)

Open Vibe 是一个桌面端 Tauri 应用，用于在本地工作区中编排多个 Codex agent。它提供工作区侧边栏、用于快速入口的主页仪表盘，以及基于 Codex app-server 协议的线程式对话视图。

本项目起源于 CodexMonitor 的 fork，并做了大量定制：

- 多主题 UI（亮/暗 + 颜色主题）
- 线程标签页，快速切换并持久化布局
- 通过 Happy bridge 实现移动端接力（实验性）
- 右侧面板更深入的 Git + PR 流程
- 线程列表/恢复的性能监控

## 功能特性

### 工作区与线程

- 添加并持久化工作区，分组/排序，并从主页仪表盘快速进入最近的 agent 活动。
- 每个工作区启动一个 `codex app-server`，恢复线程并跟踪未读/运行状态。
- 通过 worktree 和 clone agent 实现隔离工作；worktree 存放在应用数据目录（兼容旧的 `.codex-worktrees`）。
- 线程管理：置顶/重命名/归档/复制、每线程草稿、停止/中断进行中的 turn。
- 线程标签页支持每标签状态、快速切换和置顶排序。
- 可选远端后端（daemon）模式，用于在另一台机器运行 Codex。

### 编辑器与 Agent 控制

- 支持队列发送与图片附件（选择器、拖放、粘贴）。
- 技能（`$`）、提示词（`/prompts:`）、审阅（`/review`）和文件路径（`@`）自动补全。
- 模型选择、协作模式（启用时）、推理强度、访问模式和上下文使用环。
- 按住说话的听写快捷键与实时波形（Whisper）。
- 渲染 reasoning/tool/diff 类型的条目并处理审批提示。
- 可选 Happy bridge 以同步对话到移动端（实验性）。

### Git 与 GitHub

- Diff 统计、已暂存/未暂存文件 diff、撤销/暂存控制与提交日志。
- 分支列表与切换/新建，包含与上游的 ahead/behind 计数。
- 通过 `gh` 查看 GitHub Issues 和 Pull Requests（列表、diff、评论），并在浏览器中打开提交/PR。
- PR 生成器：“Ask PR” 将 PR 上下文发送到新线程。

### 文件与提示词

- 文件树支持搜索、文件类型图标与在 Finder 中显示。
- 全局/工作区提示词库：创建/编辑/删除/移动，并在当前或新线程中运行。

### UI 与体验

- 侧边栏/右侧/计划/终端/调试面板可调整大小并持久化。
- 响应式布局（桌面/平板/手机）并支持标签式导航。
- 侧边栏用量与额度仪表 + 主页用量快照。
- 终端 Dock 支持多标签后台命令（实验性）。
- 内置更新（toast 提示下载/安装）、调试面板复制/清空、提示音通知，以及 macOS 叠加标题栏与毛玻璃效果 + 降低透明度开关。
- 主题预设位于 `src/styles/theme-*.css`，支持亮/暗模式。

## 环境要求

- Node.js + npm
- Rust 工具链（stable）
- CMake（原生依赖需要；非 Windows 平台的 Whisper/听写使用）
- 系统已安装 Codex，`PATH` 中可用 `codex`
- Git CLI（worktree 操作需要）
- GitHub CLI（`gh`，用于 Issues 面板，可选）

如果 `codex` 不在 `PATH` 中，可在设置里配置 Codex 路径（支持按工作区覆盖）。
如果遇到原生构建错误，请运行：

```bash
npm run doctor
```

## 快速开始

安装依赖：

```bash
npm install
```

开发模式运行：

```bash
npm run tauri dev
```

## 发布构建

构建生产版 Tauri 包（app + dmg）：

```bash
npm run tauri build
```

macOS 应用包位于 `src-tauri/target/release/bundle/macos/`。

### Windows（可选）

Windows 构建是 opt-in，并使用单独的 Tauri 配置文件以避免 macOS 专用窗口效果。

```bash
npm run tauri:build:win
```

产物位置：

- `src-tauri/target/release/bundle/nsis/`（安装包 exe）
- `src-tauri/target/release/bundle/msi/`（msi）

注意：Windows 构建当前禁用听写（避免 `whisper-rs`/bindgen 需要 LLVM/libclang）。

## 类型检查

运行 TypeScript 检查（不生成输出）：

```bash
npm run typecheck
```

注意：`npm run build` 在打包前也会先运行 `tsc`。

## 项目结构

```
src/
  features/         功能切片 UI + hooks
  services/         Tauri IPC 封装 + 事件中心
  styles/           分区域 CSS 与主题预设
  types.ts          共享类型
src-tauri/
  src/lib.rs        Tauri 后端 + codex app-server 客户端
  src/happy_bridge.rs  Happy bridge 集成
  tauri.conf.json   窗口配置
```

## 说明

- 工作区持久化到应用数据目录下的 `workspaces.json`。
- 应用设置持久化到应用数据目录下的 `settings.json`（Codex 路径、默认访问模式、UI 缩放）。
- UI 中支持实验性设置：协作模式（`features.collab`）、后台终端（`features.unified_exec`）、Steer 模式（`features.steer`）与 Happy bridge（移动端同步）。
- 启动时与窗口激活时，应用会为每个工作区重新连接并刷新线程列表。
- 线程通过对 `thread/list` 的结果按工作区 `cwd` 过滤恢复。
- 选择线程时会调用 `thread/resume` 以从磁盘刷新消息。
- CLI 会话若 `cwd` 与工作区路径一致则会显示；除非恢复线程，否则不会实时流式传输。
- 应用通过 stdio 使用 `codex app-server`；参见 `src-tauri/src/lib.rs`。
- Codex 会话默认使用 Codex home（通常是 `~/.codex`）；若工作区存在旧的 `.codexmonitor/`，该工作区会使用它。
- worktree agent 存放在应用数据目录 `worktrees/<workspace-id>` 下；旧的 `.codex-worktrees/` 路径仍支持，应用不再修改仓库 `.gitignore`。
- UI 状态（面板大小、降低透明度开关、最近线程活动）存储在 `localStorage`。
- 自定义提示词从 `$CODEX_HOME/prompts`（或 `~/.codex/prompts`）加载，支持可选的 frontmatter 描述/参数提示。

## Tauri IPC 接口

前端调用位于 `src/services/tauri.ts`，对应 `src-tauri/src/lib.rs` 中的命令。核心命令包括：

- 工作区生命周期：`list_workspaces`, `add_workspace`, `add_worktree`, `remove_workspace`, `remove_worktree`, `connect_workspace`, `update_workspace_settings`。
- 线程：`start_thread`, `list_threads`, `resume_thread`, `archive_thread`, `send_user_message`, `turn_interrupt`, `respond_to_server_request`。
- 审阅 + 模型：`start_review`, `model_list`, `account_rate_limits`, `skills_list`。
- Git + 文件：`get_git_status`, `get_git_diffs`, `get_git_log`, `get_git_remote`, `list_git_branches`, `checkout_git_branch`, `create_git_branch`, `list_workspace_files`。
