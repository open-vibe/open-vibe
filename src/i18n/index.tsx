import { createContext, useContext, useMemo, type ReactNode } from "react";

export type AppLanguage = "system" | "en" | "zh-CN";
export type ResolvedLanguage = "en" | "zh-CN";

type TranslationKey = keyof typeof en;
type TranslationParams = Record<string, string | number>;

const en = {
  "language.system": "System",
  "language.english": "English",
  "language.chinese": "Simplified Chinese",
  "settings.language.label": "Language",
  "settings.language.help": "Choose the display language for the app.",
  "composer.collaboration": "Collaboration",
  "composer.noModels": "No models",
  "composer.default": "Default",
  "composer.access.readOnly": "Read only",
  "composer.access.onRequest": "On-Request",
  "composer.access.full": "Full access",
  "composer.contextFree": "Context free {percent}%",
  "composer.contextFreeUnknown": "Context free --",
  "git.mode.diff": "Diff",
  "git.mode.log": "Log",
  "git.mode.issues": "Issues",
  "git.mode.prs": "PRs",
  "git.depth": "Depth",
  "git.scanWorkspace": "Scan workspace",
  "git.pickFolder": "Pick folder",
  "git.useWorkspaceRoot": "Use workspace root",
  "git.change": "Change",
  "git.path": "Path",
  "git.chooseRepo": "Choose a repo for this workspace.",
  "git.scanning": "Scanning for repositories...",
  "git.issues.title": "GitHub issues",
  "git.prs.title": "GitHub pull requests",
  "git.commits.loading": "Loading commits...",
  "git.commits.none": "No commits",
  "git.commits.noneYet": "No commits yet.",
  "git.upstream.none": "No upstream configured",
  "git.upstream.label": "Upstream {name}",
  "git.stageChanges": "Stage Changes",
  "git.unstageChanges": "Unstage Changes",
  "git.discardChanges": "Discard Changes",
  "git.stageAllChanges": "Stage All Changes",
  "git.unstageAllChanges": "Unstage All Changes",
  "git.discardAllChanges": "Discard All Changes",
  "git.applyWorktree": "Apply changes to parent workspace",
};

const zhCN: Record<TranslationKey, string> = {
  "language.system": "跟随系统",
  "language.english": "English",
  "language.chinese": "简体中文",
  "settings.language.label": "语言",
  "settings.language.help": "选择应用显示语言。",
  "composer.collaboration": "协作模式",
  "composer.noModels": "暂无模型",
  "composer.default": "默认",
  "composer.access.readOnly": "只读",
  "composer.access.onRequest": "按需请求",
  "composer.access.full": "完全访问",
  "composer.contextFree": "上下文剩余 {percent}%",
  "composer.contextFreeUnknown": "上下文剩余 --",
  "git.mode.diff": "差异",
  "git.mode.log": "提交记录",
  "git.mode.issues": "问题",
  "git.mode.prs": "拉取请求",
  "git.depth": "深度",
  "git.scanWorkspace": "扫描工作区",
  "git.pickFolder": "选择文件夹",
  "git.useWorkspaceRoot": "使用工作区根目录",
  "git.change": "更改",
  "git.path": "路径",
  "git.chooseRepo": "为此工作区选择一个仓库。",
  "git.scanning": "正在扫描仓库...",
  "git.issues.title": "GitHub 问题",
  "git.prs.title": "GitHub 拉取请求",
  "git.commits.loading": "正在加载提交...",
  "git.commits.none": "没有提交",
  "git.commits.noneYet": "暂无提交",
  "git.upstream.none": "未配置上游",
  "git.upstream.label": "上游 {name}",
  "git.stageChanges": "暂存更改",
  "git.unstageChanges": "取消暂存",
  "git.discardChanges": "丢弃更改",
  "git.stageAllChanges": "全部暂存",
  "git.unstageAllChanges": "全部取消暂存",
  "git.discardAllChanges": "全部丢弃",
  "git.applyWorktree": "应用更改到父工作区",
};

const dictionaries: Record<ResolvedLanguage, Record<TranslationKey, string>> = {
  en,
  "zh-CN": zhCN,
};

function resolveSystemLanguage(): ResolvedLanguage {
  if (typeof navigator === "undefined") {
    return "en";
  }
  const locale =
    navigator.languages?.[0] ?? navigator.language ?? "en";
  return locale.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

export function resolveLanguage(language: AppLanguage): ResolvedLanguage {
  if (language === "system") {
    return resolveSystemLanguage();
  }
  return language === "zh-CN" ? "zh-CN" : "en";
}

function formatTemplate(template: string, params?: TranslationParams) {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}

type I18nContextValue = {
  language: ResolvedLanguage;
  rawLanguage: AppLanguage;
  t: (key: TranslationKey, params?: TranslationParams) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  language,
  children,
}: {
  language: AppLanguage;
  children: ReactNode;
}) {
  const resolved = useMemo(() => resolveLanguage(language), [language]);
  const dictionary = dictionaries[resolved];
  const value = useMemo<I18nContextValue>(() => {
    const translate = (key: TranslationKey, params?: TranslationParams) => {
      const template = dictionary[key] ?? en[key] ?? key;
      return formatTemplate(template, params);
    };
    return {
      language: resolved,
      rawLanguage: language,
      t: translate,
    };
  }, [dictionary, language, resolved]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider.");
  }
  return context;
}
