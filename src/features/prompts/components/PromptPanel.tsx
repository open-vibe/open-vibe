import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { CustomPromptOption } from "../../../types";
import { expandCustomPromptText, getPromptArgumentHint } from "../../../utils/customPrompts";
import { PanelTabs, type PanelTabId } from "../../layout/components/PanelTabs";
import { Menu, MenuItem } from "@tauri-apps/api/menu";
import { LogicalPosition } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import MoreHorizontal from "lucide-react/dist/esm/icons/more-horizontal";
import Plus from "lucide-react/dist/esm/icons/plus";
import ScrollText from "lucide-react/dist/esm/icons/scroll-text";
import Search from "lucide-react/dist/esm/icons/search";
import { useI18n } from "../../../i18n";

type PromptPanelProps = {
  prompts: CustomPromptOption[];
  workspacePath: string | null;
  filePanelMode: PanelTabId;
  onFilePanelModeChange: (mode: PanelTabId) => void;
  onSendPrompt: (text: string) => void | Promise<void>;
  onSendPromptToNewAgent: (text: string) => void | Promise<void>;
  onCreatePrompt: (data: {
    scope: "workspace" | "global";
    name: string;
    description?: string | null;
    argumentHint?: string | null;
    content: string;
  }) => void | Promise<void>;
  onUpdatePrompt: (data: {
    path: string;
    name: string;
    description?: string | null;
    argumentHint?: string | null;
    content: string;
  }) => void | Promise<void>;
  onDeletePrompt: (path: string) => void | Promise<void>;
  onMovePrompt: (data: { path: string; scope: "workspace" | "global" }) => void | Promise<void>;
  onRevealWorkspacePrompts: () => void | Promise<void>;
  onRevealGeneralPrompts: () => void | Promise<void>;
  canRevealGeneralPrompts: boolean;
};

const PROMPTS_PREFIX = "prompts:";

type PromptEditorState = {
  mode: "create" | "edit";
  scope: "workspace" | "global";
  name: string;
  description: string;
  argumentHint: string;
  content: string;
  path?: string;
};

function buildPromptCommand(name: string, args: string) {
  const trimmedArgs = args.trim();
  return `/${PROMPTS_PREFIX}${name}${trimmedArgs ? ` ${trimmedArgs}` : ""}`;
}

function isWorkspacePrompt(prompt: CustomPromptOption) {
  return prompt.scope === "workspace";
}

export function PromptPanel({
  prompts,
  workspacePath,
  filePanelMode,
  onFilePanelModeChange,
  onSendPrompt,
  onSendPromptToNewAgent,
  onCreatePrompt,
  onUpdatePrompt,
  onDeletePrompt,
  onMovePrompt,
  onRevealWorkspacePrompts,
  onRevealGeneralPrompts,
  canRevealGeneralPrompts,
}: PromptPanelProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [argsByPrompt, setArgsByPrompt] = useState<Record<string, string>>({});
  const [editor, setEditor] = useState<PromptEditorState | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeletePath, setPendingDeletePath] = useState<string | null>(null);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const highlightTimer = useRef<number | null>(null);
  const normalizedQuery = query.trim().toLowerCase();

  const showError = (error: unknown) => {
    window.alert(error instanceof Error ? error.message : String(error));
  };

  const resetEditorState = () => {
    setEditorError(null);
    setPendingDeletePath(null);
  };

  const updateEditor = (patch: Partial<PromptEditorState>) => {
    setEditor((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  useEffect(() => {
    return () => {
      if (highlightTimer.current) {
        window.clearTimeout(highlightTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!pendingDeletePath) {
      return;
    }
    const stillExists = prompts.some((prompt) => prompt.path === pendingDeletePath);
    if (!stillExists) {
      setPendingDeletePath(null);
    }
  }, [pendingDeletePath, prompts]);

  const triggerHighlight = (key: string) => {
    if (!key) {
      return;
    }
    if (highlightTimer.current) {
      window.clearTimeout(highlightTimer.current);
    }
    setHighlightKey(key);
    highlightTimer.current = window.setTimeout(() => {
      setHighlightKey(null);
    }, 650);
  };

  const buildPromptText = (prompt: CustomPromptOption, args: string) => {
    const command = buildPromptCommand(prompt.name, args);
    const expansion = expandCustomPromptText(command, [prompt]);
    if (expansion && "error" in expansion) {
      showError(expansion.error);
      return null;
    }
    if (expansion && "expanded" in expansion) {
      return expansion.expanded;
    }
    return prompt.content;
  };

  const filteredPrompts = useMemo(() => {
    if (!normalizedQuery) {
      return prompts;
    }
    return prompts.filter((prompt) => {
      const haystack = `${prompt.name} ${prompt.description ?? ""} ${prompt.path}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, prompts]);

  const { workspacePrompts, globalPrompts } = useMemo(() => {
    const workspaceEntries: CustomPromptOption[] = [];
    const globalEntries: CustomPromptOption[] = [];
    filteredPrompts.forEach((prompt) => {
      if (isWorkspacePrompt(prompt)) {
        workspaceEntries.push(prompt);
      } else {
        globalEntries.push(prompt);
      }
    });
    return { workspacePrompts: workspaceEntries, globalPrompts: globalEntries };
  }, [filteredPrompts]);

  const totalCount = filteredPrompts.length;
  const hasPrompts = totalCount > 0;

  const handleArgsChange = (key: string, value: string) => {
    setArgsByPrompt((prev) => ({ ...prev, [key]: value }));
  };

  const startCreate = (scope: "workspace" | "global") => {
    resetEditorState();
    setEditor({
      mode: "create",
      scope,
      name: "",
      description: "",
      argumentHint: "",
      content: "",
    });
  };

  const startEdit = (prompt: CustomPromptOption) => {
    const scope = isWorkspacePrompt(prompt) ? "workspace" : "global";
    resetEditorState();
    setEditor({
      mode: "edit",
      scope,
      name: prompt.name,
      description: prompt.description ?? "",
      argumentHint: prompt.argumentHint ?? "",
      content: prompt.content ?? "",
      path: prompt.path,
    });
  };

  const handleSave = async () => {
    if (!editor || isSaving) {
      return;
    }
    const name = editor.name.trim();
    if (!name) {
      setEditorError(t("prompts.editor.error.nameRequired"));
      return;
    }
    if (/\s/.test(name)) {
      setEditorError(t("prompts.editor.error.nameNoWhitespace"));
      return;
    }
    setEditorError(null);
    setIsSaving(true);
    const description = editor.description.trim() || null;
    const argumentHint = editor.argumentHint.trim() || null;
    const content = editor.content;
    try {
      if (editor.mode === "create") {
        await onCreatePrompt({
          scope: editor.scope,
          name,
          description,
          argumentHint,
          content,
        });
        triggerHighlight(name);
      } else if (editor.path) {
        await onUpdatePrompt({
          path: editor.path,
          name,
          description,
          argumentHint,
          content,
        });
        triggerHighlight(editor.path ?? name);
      }
      setEditor(null);
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRequest = (prompt: CustomPromptOption) => {
    if (!prompt.path) {
      return;
    }
    setPendingDeletePath(prompt.path);
  };

  const handleDeleteConfirm = async (prompt: CustomPromptOption) => {
    if (!prompt.path) {
      return;
    }
    try {
      await onDeletePrompt(prompt.path);
      setPendingDeletePath((current) =>
        current === prompt.path ? null : current,
      );
    } catch (error) {
      showError(error);
    }
  };

  const handleMove = async (prompt: CustomPromptOption, scope: "workspace" | "global") => {
    if (!prompt.path) {
      return;
    }
    try {
      await onMovePrompt({ path: prompt.path, scope });
      triggerHighlight(prompt.name);
    } catch (error) {
      showError(error);
    }
  };

  const showPromptMenu = async (
    event: ReactMouseEvent<HTMLButtonElement>,
    prompt: CustomPromptOption,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const scope = isWorkspacePrompt(prompt) ? "workspace" : "global";
    const nextScope = scope === "workspace" ? "global" : "workspace";
    const moveLabel =
      nextScope === "workspace"
        ? t("prompts.menu.moveToWorkspace")
        : t("prompts.menu.moveToGeneral");
    const menu = await Menu.new({
      items: [
        await MenuItem.new({
          text: t("prompts.menu.edit"),
          action: () => startEdit(prompt),
        }),
        await MenuItem.new({
          text: moveLabel,
          action: () => void handleMove(prompt, nextScope),
        }),
        await MenuItem.new({
          text: t("prompts.menu.delete"),
          action: () => handleDeleteRequest(prompt),
        }),
      ],
    });
    const position = new LogicalPosition(event.clientX, event.clientY);
    const window = getCurrentWindow();
    await menu.popup(position, window);
  };

  const renderPromptRow = (prompt: CustomPromptOption) => {
    const hint = getPromptArgumentHint(prompt);
    const showArgsInput = Boolean(hint);
    const key = prompt.path || prompt.name;
    const argsValue = argsByPrompt[key] ?? "";
    const effectiveArgs = showArgsInput ? argsValue : "";
    const isHighlighted = highlightKey === prompt.path || highlightKey === prompt.name;
    return (
      <div className={`prompt-row${isHighlighted ? " is-highlight" : ""}`} key={key}>
        <div className="prompt-row-header">
          <div className="prompt-name">{prompt.name}</div>
          {prompt.description && (
            <div className="prompt-description">{prompt.description}</div>
          )}
        </div>
        {hint && <div className="prompt-hint">{hint}</div>}
        <div className="prompt-actions">
          {showArgsInput ? (
            <input
              className="prompt-args-input"
              type="text"
              placeholder={hint ?? t("prompts.actions.args.placeholder")}
              value={argsValue}
              onChange={(event) => handleArgsChange(key, event.target.value)}
              aria-label={t("prompts.actions.args.aria", { name: prompt.name })}
            />
          ) : null}
          <button
            type="button"
            className="ghost prompt-action"
            onClick={() => {
              const text = buildPromptText(prompt, effectiveArgs);
              if (!text) {
                return;
              }
              void onSendPrompt(text);
            }}
            title={t("prompts.actions.send.title")}
          >
            {t("prompts.actions.send")}
          </button>
          <button
            type="button"
            className="ghost prompt-action"
            onClick={() => {
              const text = buildPromptText(prompt, effectiveArgs);
              if (!text) {
                return;
              }
              void onSendPromptToNewAgent(text);
            }}
            title={t("prompts.actions.sendNew.title")}
          >
            {t("prompts.actions.sendNew")}
          </button>
          <button
            type="button"
            className="ghost icon-button prompt-action-menu"
            onClick={(event) => void showPromptMenu(event, prompt)}
            aria-label={t("prompts.actions.menu")}
            title={t("prompts.actions.menu")}
          >
            <MoreHorizontal aria-hidden />
          </button>
        </div>
        {pendingDeletePath === prompt.path && (
          <div className="prompt-delete-confirm">
            <span>{t("prompts.delete.confirm")}</span>
            <button
              type="button"
              className="ghost prompt-action"
              onClick={() => void handleDeleteConfirm(prompt)}
            >
              {t("prompts.delete.action")}
            </button>
            <button
              type="button"
              className="ghost prompt-action"
              onClick={() => setPendingDeletePath(null)}
            >
              {t("prompts.delete.cancel")}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="diff-panel prompt-panel">
      <div className="git-panel-header">
        <PanelTabs active={filePanelMode} onSelect={onFilePanelModeChange} />
        <div className="prompt-panel-meta">
          {hasPrompts
            ? t(
                totalCount === 1
                  ? "prompts.meta.count.one"
                  : "prompts.meta.count.other",
                { count: totalCount },
              )
            : t("prompts.meta.none")}
        </div>
      </div>
      <div className="file-tree-search">
        <Search className="file-tree-search-icon" aria-hidden />
        <input
          className="file-tree-search-input"
          type="search"
          placeholder={t("prompts.filter.placeholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={t("prompts.filter.aria")}
        />
      </div>
      <div className="prompt-panel-scroll">
        {editor && (
          <div className="prompt-editor">
            <div className="prompt-editor-row">
              <label className="prompt-editor-label">
                {t("prompts.editor.name")}
                <input
                  className="prompt-args-input"
                  type="text"
                  value={editor.name}
                  onChange={(event) => updateEditor({ name: event.target.value })}
                  placeholder={t("prompts.editor.namePlaceholder")}
                />
              </label>
              <label className="prompt-editor-label">
                {t("prompts.editor.scope")}
                <select
                  className="prompt-scope-select"
                  value={editor.scope}
                  onChange={(event) =>
                    updateEditor({
                      scope: event.target.value as PromptEditorState["scope"],
                    })
                  }
                  disabled={editor.mode === "edit"}
                >
                  <option value="workspace">
                    {t("prompts.editor.scope.workspace")}
                  </option>
                  <option value="global">
                    {t("prompts.editor.scope.global")}
                  </option>
                </select>
              </label>
            </div>
            <div className="prompt-editor-row">
              <label className="prompt-editor-label">
                {t("prompts.editor.description")}
                <input
                  className="prompt-args-input"
                  type="text"
                  value={editor.description}
                  onChange={(event) => updateEditor({ description: event.target.value })}
                  placeholder={t("prompts.editor.descriptionPlaceholder")}
                />
              </label>
              <label className="prompt-editor-label">
                {t("prompts.editor.argumentHint")}
                <input
                  className="prompt-args-input"
                  type="text"
                  value={editor.argumentHint}
                  onChange={(event) => updateEditor({ argumentHint: event.target.value })}
                  placeholder={t("prompts.editor.argumentHintPlaceholder")}
                />
              </label>
            </div>
            <label className="prompt-editor-label">
              {t("prompts.editor.content")}
              <textarea
                className="prompt-editor-textarea"
                value={editor.content}
                onChange={(event) => updateEditor({ content: event.target.value })}
                placeholder={t("prompts.editor.contentPlaceholder")}
                rows={6}
              />
            </label>
            {editorError && <div className="prompt-editor-error">{editorError}</div>}
            <div className="prompt-editor-actions">
              <button
                type="button"
                className="ghost prompt-action"
                onClick={() => setEditor(null)}
                disabled={isSaving}
              >
                {t("prompts.editor.actions.cancel")}
              </button>
              <button
                type="button"
                className="ghost prompt-action"
                onClick={() => void handleSave()}
                disabled={isSaving}
              >
                {editor.mode === "create"
                  ? t("prompts.editor.actions.create")
                  : t("prompts.editor.actions.save")}
              </button>
            </div>
          </div>
        )}
        <div className="prompt-section">
          <div className="prompt-section-header">
            <div className="prompt-section-title">
              {t("prompts.section.workspace")}
            </div>
            <button
              type="button"
              className="ghost icon-button prompt-section-add"
              onClick={() => startCreate("workspace")}
              aria-label={t("prompts.section.addWorkspace")}
              title={t("prompts.section.addWorkspace")}
            >
              <Plus aria-hidden />
            </button>
          </div>
          {workspacePrompts.length > 0 ? (
            <div className="prompt-list">
              {workspacePrompts.map((prompt) => renderPromptRow(prompt))}
            </div>
          ) : (
            <div className="prompt-empty-card">
              <ScrollText className="prompt-empty-icon" aria-hidden />
              <div className="prompt-empty-text">
                <div className="prompt-empty-title">
                  {t("prompts.empty.workspace.title")}
                </div>
                <div className="prompt-empty-subtitle">
                  {t("prompts.empty.workspace.subtitle.before")}
                  {" "}
                  {workspacePath ? (
                    <button
                      type="button"
                      className="prompt-empty-link"
                      onClick={() => void onRevealWorkspacePrompts()}
                    >
                      {t("prompts.empty.workspace.folder")}
                    </button>
                  ) : (
                    <span className="prompt-empty-link is-disabled">
                      {t("prompts.empty.workspace.folder")}
                    </span>
                  )}
                  {t("prompts.empty.workspace.subtitle.after")}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="prompt-section">
          <div className="prompt-section-header">
            <div className="prompt-section-title">
              {t("prompts.section.global")}
            </div>
            <button
              type="button"
              className="ghost icon-button prompt-section-add"
              onClick={() => startCreate("global")}
              aria-label={t("prompts.section.addGlobal")}
              title={t("prompts.section.addGlobal")}
            >
              <Plus aria-hidden />
            </button>
          </div>
          {globalPrompts.length > 0 ? (
            <div className="prompt-list">
              {globalPrompts.map((prompt) => renderPromptRow(prompt))}
            </div>
          ) : (
            <div className="prompt-empty-card">
              <ScrollText className="prompt-empty-icon" aria-hidden />
              <div className="prompt-empty-text">
                <div className="prompt-empty-title">
                  {t("prompts.empty.global.title")}
                </div>
                <div className="prompt-empty-subtitle">
                  {t("prompts.empty.global.subtitle.before")}
                  {" "}
                  {canRevealGeneralPrompts ? (
                    <button
                      type="button"
                      className="prompt-empty-link"
                      onClick={() => void onRevealGeneralPrompts()}
                    >
                      {t("prompts.empty.global.folder")}
                    </button>
                  ) : (
                    <span className="prompt-empty-link is-disabled">
                      {t("prompts.empty.global.folder")}
                    </span>
                  )}
                  {t("prompts.empty.global.subtitle.after")}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
