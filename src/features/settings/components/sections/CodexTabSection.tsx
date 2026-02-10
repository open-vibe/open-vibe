import Stethoscope from "lucide-react/dist/esm/icons/stethoscope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { FileEditorCard } from "../../../shared/components/FileEditorCard";
import { SettingsSection } from "../SettingsSection";


export function CodexTabSection(props: any) {
  const {t, codexPathDraft, setCodexPathDraft, handleBrowseCodex, codexArgsDraft, setCodexArgsDraft, codexDirty, handleSaveCodexSettings, isSavingSettings, handleRunDoctor, doctorState, projects, codexBinOverrideDrafts, setCodexBinOverrideDrafts, handleCommitCodexBinOverride, codexBinOverrideSaving, codexBinOverrideSavedAt, setCodexBinOverrideSaving, onUpdateWorkspaceCodexBin, setCodexBinOverrideSavedAt, appSettings, handleRunWorkspaceDoctor, codexBinOverrideDoctor, codexHomeOverrideDrafts, setCodexHomeOverrideDrafts, onUpdateWorkspaceSettings, codexArgsOverrideDrafts, setCodexArgsOverrideDrafts, onUpdateAppSettings, remoteHostDraft, setRemoteHostDraft, handleCommitRemoteHost, remoteTokenDraft, setRemoteTokenDraft, handleCommitRemoteToken, globalAgentsMeta, globalAgentsError, globalAgentsContent, globalAgentsLoading, globalAgentsRefreshDisabled, globalAgentsSaveDisabled, globalAgentsSaveLabel, setGlobalAgentsContent, refreshGlobalAgents, saveGlobalAgents, globalConfigMeta, globalConfigError, globalConfigContent, globalConfigLoading, globalConfigRefreshDisabled, globalConfigSaveDisabled, globalConfigSaveLabel, setGlobalConfigContent, refreshGlobalConfig, saveGlobalConfig, normalizeOverrideValue, cn} = props;

  return (
<TabsContent value="codex" className="mt-0">
                <div className="space-y-4">
                  <SettingsSection
                    title={t("settings.codex.title")}
                    description={t("settings.codex.subtitle")}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="codex-path">
                        {t("settings.codex.path.label")}
                      </Label>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          id="codex-path"
                          value={codexPathDraft}
                          placeholder="codex"
                          onChange={(event: any) =>
                            setCodexPathDraft(event.target.value)
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleBrowseCodex}
                        >
                          {t("settings.action.browse")}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setCodexPathDraft("")}
                        >
                          {t("settings.action.usePath")}
                        </Button>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {t("settings.codex.path.help")}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="codex-args">
                        {t("settings.codex.args.label")}
                      </Label>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          id="codex-args"
                          value={codexArgsDraft}
                          placeholder="--profile personal"
                          onChange={(event: any) =>
                            setCodexArgsDraft(event.target.value)
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setCodexArgsDraft("")}
                        >
                          {t("settings.action.clear")}
                        </Button>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {t("settings.codex.args.help")}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {codexDirty && (
                        <Button
                          type="button"
                          onClick={handleSaveCodexSettings}
                          disabled={isSavingSettings}
                        >
                          {isSavingSettings
                            ? t("settings.action.saving")
                            : t("settings.action.save")}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleRunDoctor}
                        disabled={doctorState.status === "running"}
                      >
                        <Stethoscope className="h-4 w-4" aria-hidden />
                        {doctorState.status === "running"
                          ? t("settings.action.running")
                          : t("settings.action.runDoctor")}
                      </Button>
                    </div>
                    {doctorState.result && (
                      <div
                        className={cn(
                          "rounded-md border border-border/60 p-3 text-sm",
                          doctorState.result.ok
                            ? "border-emerald-500/40 bg-emerald-50/40"
                            : "border-destructive/40 bg-destructive/10",
                        )}
                      >
                        <div className="font-medium">
                          {doctorState.result.ok
                            ? t("settings.codex.doctor.okTitle")
                            : t("settings.codex.doctor.errorTitle")}
                        </div>
                        <div className="mt-2 space-y-1 text-sm">
                          <div>
                            {t("settings.codex.doctor.version", {
                              value:
                                doctorState.result.version ??
                                t("settings.codex.doctor.unknown"),
                            })}
                          </div>
                          <div>
                            {t("settings.codex.doctor.appServer", {
                              value: doctorState.result.appServerOk
                                ? t("settings.codex.doctor.ok")
                                : t("settings.codex.doctor.failed"),
                            })}
                          </div>
                          <div>
                            {t("settings.codex.doctor.node", {
                              value: doctorState.result.nodeOk
                                ? t("settings.codex.doctor.okWithVersion", {
                                  version:
                                    doctorState.result.nodeVersion ??
                                    t("settings.codex.doctor.unknown"),
                                })
                                : t("settings.codex.doctor.missing"),
                            })}
                          </div>
                          {doctorState.result.details && (
                            <div>{doctorState.result.details}</div>
                          )}
                          {doctorState.result.nodeDetails && (
                            <div>{doctorState.result.nodeDetails}</div>
                          )}
                          {doctorState.result.path && (
                            <div className="text-xs text-muted-foreground">
                              {t("settings.codex.doctor.path", {
                                value: doctorState.result.path,
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </SettingsSection>
                  <SettingsSection
                    title={t("settings.codex.workspaceOverrides.title")}
                    description={t(
                      "settings.codex.workspaceOverrides.subtitle",
                    )}
                  >
                    <div className="space-y-3">
                      {projects.map((workspace: any) => (
                        <div
                          key={workspace.id}
                          className="rounded-md border border-border/60 p-3"
                        >
                          <div className="space-y-3">
                            <div>
                              <div className="text-sm font-medium">
                                {workspace.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {workspace.path}
                              </div>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label htmlFor={`override-bin-${workspace.id}`}>
                                  {t(
                                    "settings.codex.workspaceOverrides.binLabel",
                                  )}
                                </Label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    id={`override-bin-${workspace.id}`}
                                    value={
                                      codexBinOverrideDrafts[workspace.id] ?? ""
                                    }
                                    placeholder={t(
                                      "settings.codex.workspaceOverrides.binPlaceholder",
                                    )}
                                    onChange={(event: any) =>
                                      setCodexBinOverrideDrafts((prev: any) => ({
                                        ...prev,
                                        [workspace.id]: event.target.value,
                                      }))
                                    }
                                    onBlur={() => {
                                      void handleCommitCodexBinOverride(
                                        workspace,
                                      );
                                    }}
                                    onKeyDown={(event: any) => {
                                      if (event.key === "Enter") {
                                        event.currentTarget.blur();
                                      }
                                    }}
                                    aria-label={t(
                                      "settings.codex.workspaceOverrides.binAria",
                                      { name: workspace.name },
                                    )}
                                  />
                                  {(() => {
                                    const draft =
                                      codexBinOverrideDrafts[workspace.id] ??
                                      "";
                                    const nextValue =
                                      normalizeOverrideValue(draft);
                                    const isDirty =
                                      nextValue !==
                                      (workspace.codex_bin ?? null);
                                    const isSaving =
                                      codexBinOverrideSaving[workspace.id] ??
                                      false;
                                    const savedAt =
                                      codexBinOverrideSavedAt[workspace.id] ??
                                      0;
                                    const showSaved = savedAt > 0;
                                    return isDirty ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() =>
                                          void handleCommitCodexBinOverride(
                                            workspace,
                                          )
                                        }
                                        disabled={isSaving}
                                      >
                                        {isSaving
                                          ? t("settings.action.saving")
                                          : t("settings.action.save")}
                                      </Button>
                                    ) : showSaved ? (
                                      <span className="text-xs text-muted-foreground">
                                        {t(
                                          "settings.codex.workspaceOverrides.saved",
                                        )}
                                      </span>
                                    ) : null;
                                  })()}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => {
                                      setCodexBinOverrideDrafts((prev: any) => ({
                                        ...prev,
                                        [workspace.id]: "",
                                      }));
                                      setCodexBinOverrideSaving((prev: any) => ({
                                        ...prev,
                                        [workspace.id]: true,
                                      }));
                                      await onUpdateWorkspaceCodexBin(
                                        workspace.id,
                                        null,
                                      );
                                      setCodexBinOverrideSavedAt((prev: any) => ({
                                        ...prev,
                                        [workspace.id]: Date.now(),
                                      }));
                                      window.setTimeout(() => {
                                        setCodexBinOverrideSavedAt((prev: any) => {
                                          if (!prev[workspace.id]) {
                                            return prev;
                                          }
                                          const next = { ...prev };
                                          delete next[workspace.id];
                                          return next;
                                        });
                                      }, 2000);
                                      setCodexBinOverrideSaving((prev: any) => ({
                                        ...prev,
                                        [workspace.id]: false,
                                      }));
                                    }}
                                    disabled={
                                      codexBinOverrideSaving[workspace.id]
                                    }
                                  >
                                    {t("settings.action.clear")}
                                  </Button>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  <span>
                                    {t(
                                      "settings.codex.workspaceOverrides.savedValue",
                                      {
                                        value:
                                          workspace.codex_bin ??
                                          t("settings.value.none"),
                                      },
                                    )}
                                  </span>
                                  <span>
                                    {t(
                                      "settings.codex.workspaceOverrides.effectiveBin",
                                      {
                                        value:
                                          workspace.codex_bin ??
                                          appSettings.codexBin ??
                                          "codex",
                                      },
                                    )}
                                  </span>
                                  <span>
                                    {t(
                                      "settings.codex.workspaceOverrides.effectiveHome",
                                      {
                                        value:
                                          workspace.settings.codexHome ??
                                          t("settings.value.default"),
                                      },
                                    )}
                                  </span>
                                  <span>
                                    {t(
                                      "settings.codex.workspaceOverrides.effectiveArgs",
                                      {
                                        value:
                                          workspace.settings.codexArgs ??
                                          appSettings.codexArgs ??
                                          t("settings.value.none"),
                                      },
                                    )}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2"
                                    onClick={() =>
                                      void handleRunWorkspaceDoctor(workspace)
                                    }
                                    disabled={
                                      codexBinOverrideDoctor[workspace.id]
                                        ?.status === "running"
                                    }
                                  >
                                    {codexBinOverrideDoctor[workspace.id]
                                      ?.status === "running"
                                      ? t(
                                        "settings.codex.workspaceOverrides.testRunning",
                                      )
                                      : t(
                                        "settings.codex.workspaceOverrides.test",
                                      )}
                                  </Button>
                                  {codexBinOverrideDoctor[workspace.id]
                                    ?.status === "done" &&
                                    (codexBinOverrideDoctor[workspace.id]
                                      ?.result ? (
                                      <span>
                                        {codexBinOverrideDoctor[workspace.id]
                                          ?.result?.ok
                                          ? t(
                                            "settings.codex.workspaceOverrides.testOk",
                                          )
                                          : t(
                                            "settings.codex.workspaceOverrides.testFailed",
                                          )}
                                      </span>
                                    ) : codexBinOverrideDoctor[workspace.id]
                                      ?.error ? (
                                      <span>
                                        {t(
                                          "settings.codex.workspaceOverrides.testFailed",
                                        )}
                                      </span>
                                    ) : null)}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label
                                  htmlFor={`override-home-${workspace.id}`}
                                >
                                  {t(
                                    "settings.codex.workspaceOverrides.homeLabel",
                                  )}
                                </Label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    id={`override-home-${workspace.id}`}
                                    value={
                                      codexHomeOverrideDrafts[workspace.id] ??
                                      ""
                                    }
                                    placeholder={t(
                                      "settings.codex.workspaceOverrides.homePlaceholder",
                                    )}
                                    onChange={(event: any) =>
                                      setCodexHomeOverrideDrafts((prev: any) => ({
                                        ...prev,
                                        [workspace.id]: event.target.value,
                                      }))
                                    }
                                    onBlur={async () => {
                                      const draft =
                                        codexHomeOverrideDrafts[workspace.id] ??
                                        "";
                                      const nextValue =
                                        normalizeOverrideValue(draft);
                                      if (
                                        nextValue ===
                                        (workspace.settings.codexHome ?? null)
                                      ) {
                                        return;
                                      }
                                      await onUpdateWorkspaceSettings(
                                        workspace.id,
                                        {
                                          codexHome: nextValue,
                                        },
                                      );
                                    }}
                                    aria-label={t(
                                      "settings.codex.workspaceOverrides.homeAria",
                                      { name: workspace.name },
                                    )}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => {
                                      setCodexHomeOverrideDrafts((prev: any) => ({
                                        ...prev,
                                        [workspace.id]: "",
                                      }));
                                      await onUpdateWorkspaceSettings(
                                        workspace.id,
                                        {
                                          codexHome: null,
                                        },
                                      );
                                    }}
                                  >
                                    {t("settings.action.clear")}
                                  </Button>
                                </div>
                              </div>
                              <div className="space-y-2 md:col-span-2">
                                <Label
                                  htmlFor={`override-args-${workspace.id}`}
                                >
                                  {t(
                                    "settings.codex.workspaceOverrides.argsLabel",
                                  )}
                                </Label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    id={`override-args-${workspace.id}`}
                                    value={
                                      codexArgsOverrideDrafts[workspace.id] ??
                                      ""
                                    }
                                    placeholder={t(
                                      "settings.codex.workspaceOverrides.argsPlaceholder",
                                    )}
                                    onChange={(event: any) =>
                                      setCodexArgsOverrideDrafts((prev: any) => ({
                                        ...prev,
                                        [workspace.id]: event.target.value,
                                      }))
                                    }
                                    onBlur={async () => {
                                      const draft =
                                        codexArgsOverrideDrafts[workspace.id] ??
                                        "";
                                      const nextValue =
                                        normalizeOverrideValue(draft);
                                      if (
                                        nextValue ===
                                        (workspace.settings.codexArgs ?? null)
                                      ) {
                                        return;
                                      }
                                      await onUpdateWorkspaceSettings(
                                        workspace.id,
                                        {
                                          codexArgs: nextValue,
                                        },
                                      );
                                    }}
                                    aria-label={t(
                                      "settings.codex.workspaceOverrides.argsAria",
                                      { name: workspace.name },
                                    )}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => {
                                      setCodexArgsOverrideDrafts((prev: any) => ({
                                        ...prev,
                                        [workspace.id]: "",
                                      }));
                                      await onUpdateWorkspaceSettings(
                                        workspace.id,
                                        {
                                          codexArgs: null,
                                        },
                                      );
                                    }}
                                  >
                                    {t("settings.action.clear")}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {projects.length === 0 && (
                        <div className="text-sm text-muted-foreground">
                          {t("settings.projects.project.empty")}
                        </div>
                      )}
                    </div>
                  </SettingsSection>
                  <SettingsSection
                    title={t("settings.codex.access.title")}
                    description={t("settings.codex.access.subtitle")}
                  >
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="default-access">
                            {t("settings.codex.defaultAccess")}
                          </Label>
                          <Select
                            value={appSettings.defaultAccessMode}
                            onValueChange={(value: any) =>
                              void onUpdateAppSettings({
                                ...appSettings,
                                defaultAccessMode:
                                  value as any,
                              })
                            }
                          >
                            <SelectTrigger id="default-access">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="read-only">
                                {t("settings.codex.access.readOnly")}
                              </SelectItem>
                              <SelectItem value="current">
                                {t("settings.codex.access.onRequest")}
                              </SelectItem>
                              <SelectItem value="full-access">
                                {t("settings.codex.access.full")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="backend-mode">
                            {t("settings.codex.backendMode")}
                          </Label>
                          <Select
                            value={appSettings.backendMode}
                            onValueChange={(value: any) =>
                              void onUpdateAppSettings({
                                ...appSettings,
                                backendMode:
                                  value as any,
                              })
                            }
                          >
                            <SelectTrigger id="backend-mode">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="local">
                                {t("settings.codex.backend.local")}
                              </SelectItem>
                              <SelectItem value="remote">
                                {t("settings.codex.backend.remote")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.codex.backend.help")}
                          </div>
                        </div>
                      </div>
                      {appSettings.backendMode === "remote" && (
                        <div className="space-y-2 rounded-md border border-border/60 p-3">
                          <div className="text-sm font-medium">
                            {t("settings.codex.remote.title")}
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            <Input
                              value={remoteHostDraft}
                              placeholder="127.0.0.1:4732"
                              onChange={(event: any) =>
                                setRemoteHostDraft(event.target.value)
                              }
                              onBlur={() => {
                                void handleCommitRemoteHost();
                              }}
                              onKeyDown={(event: any) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void handleCommitRemoteHost();
                                }
                              }}
                              aria-label={t("settings.codex.remote.hostAria")}
                            />
                            <Input
                              type="password"
                              value={remoteTokenDraft}
                              placeholder={t(
                                "settings.codex.remote.tokenPlaceholder",
                              )}
                              onChange={(event: any) =>
                                setRemoteTokenDraft(event.target.value)
                              }
                              onBlur={() => {
                                void handleCommitRemoteToken();
                              }}
                              onKeyDown={(event: any) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void handleCommitRemoteToken();
                                }
                              }}
                              aria-label={t("settings.codex.remote.tokenAria")}
                            />
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.codex.remote.help")}
                          </div>
                        </div>
                      )}
                    </div>
                  </SettingsSection>
                  <div className="space-y-4">
                    <FileEditorCard
                      title={t("settings.codex.fileAgents.title")}
                      meta={globalAgentsMeta}
                      error={globalAgentsError}
                      value={globalAgentsContent}
                      placeholder={t("settings.codex.fileAgents.placeholder")}
                      disabled={globalAgentsLoading}
                      refreshDisabled={globalAgentsRefreshDisabled}
                      saveDisabled={globalAgentsSaveDisabled}
                      saveLabel={globalAgentsSaveLabel}
                      onChange={setGlobalAgentsContent}
                      onRefresh={() => {
                        void refreshGlobalAgents();
                      }}
                      onSave={() => {
                        void saveGlobalAgents();
                      }}
                      helpText={
                        <>
                          {t("settings.codex.fileLocation")}{" "}
                          <code>~/.codex/AGENTS.md</code>.
                        </>
                      }
                      classNames={{
                        container: "rounded-md border border-border/60 p-4",
                        header:
                          "flex flex-wrap items-center justify-between gap-2",
                        title: "text-sm font-medium",
                        actions: "flex flex-wrap items-center gap-2",
                        meta: "text-xs text-muted-foreground",
                        iconButton:
                          "inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&_svg]:h-4 [&_svg]:w-4",
                        error: "text-sm text-destructive",
                        textarea:
                          "mt-2 min-h-[160px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm",
                        help: "mt-2 text-xs text-muted-foreground",
                      }}
                    />
                    <FileEditorCard
                      title={t("settings.codex.fileConfig.title")}
                      meta={globalConfigMeta}
                      error={globalConfigError}
                      value={globalConfigContent}
                      placeholder={t("settings.codex.fileConfig.placeholder")}
                      disabled={globalConfigLoading}
                      refreshDisabled={globalConfigRefreshDisabled}
                      saveDisabled={globalConfigSaveDisabled}
                      saveLabel={globalConfigSaveLabel}
                      onChange={setGlobalConfigContent}
                      onRefresh={() => {
                        void refreshGlobalConfig();
                      }}
                      onSave={() => {
                        void saveGlobalConfig();
                      }}
                      helpText={
                        <>
                          {t("settings.codex.fileLocation")}{" "}
                          <code>~/.codex/config.toml</code>.
                        </>
                      }
                      classNames={{
                        container: "rounded-md border border-border/60 p-4",
                        header:
                          "flex flex-wrap items-center justify-between gap-2",
                        title: "text-sm font-medium",
                        actions: "flex flex-wrap items-center gap-2",
                        meta: "text-xs text-muted-foreground",
                        iconButton:
                          "inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&_svg]:h-4 [&_svg]:w-4",
                        error: "text-sm text-destructive",
                        textarea:
                          "mt-2 min-h-[160px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm",
                        help: "mt-2 text-xs text-muted-foreground",
                      }}
                    />
                  </div>
                </div>
              </TabsContent>
  );
}

