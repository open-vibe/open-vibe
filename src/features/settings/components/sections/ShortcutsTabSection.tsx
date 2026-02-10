import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { TabsContent } from "@/components/ui/tabs";
import { SettingsSection } from "../SettingsSection";

export function ShortcutsTabSection(props: any) {
  const {t, shortcutDrafts, handleShortcutKeyDown, updateShortcut, formatShortcut, getDefaultInterruptShortcut} = props;

  return (
<TabsContent value="shortcuts" className="mt-0">
                <div className="space-y-4">
                  <SettingsSection
                    title={t("settings.shortcuts.title")}
                    description={t("settings.shortcuts.subtitle")}
                  >
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          {t("settings.shortcuts.file.title")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {t("settings.shortcuts.file.subtitle")}
                        </div>
                      </div>
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label>{t("settings.shortcuts.newAgent")}</Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              className="w-56"
                              value={formatShortcut(shortcutDrafts.newAgent)}
                              onKeyDown={(event: any) =>
                                handleShortcutKeyDown(event, "newAgentShortcut")
                              }
                              placeholder={t("settings.shortcuts.placeholder")}
                              readOnly
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                void updateShortcut("newAgentShortcut", null)
                              }
                            >
                              {t("settings.action.clear")}
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("settings.shortcuts.default", {
                              value: formatShortcut("cmd+n"),
                            })}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>
                            {t("settings.shortcuts.newWorktreeAgent")}
                          </Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              className="w-56"
                              value={formatShortcut(
                                shortcutDrafts.newWorktreeAgent,
                              )}
                              onKeyDown={(event: any) =>
                                handleShortcutKeyDown(
                                  event,
                                  "newWorktreeAgentShortcut",
                                )
                              }
                              placeholder={t("settings.shortcuts.placeholder")}
                              readOnly
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                void updateShortcut(
                                  "newWorktreeAgentShortcut",
                                  null,
                                )
                              }
                            >
                              {t("settings.action.clear")}
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("settings.shortcuts.default", {
                              value: formatShortcut("cmd+shift+n"),
                            })}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>{t("settings.shortcuts.newCloneAgent")}</Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              className="w-56"
                              value={formatShortcut(
                                shortcutDrafts.newCloneAgent,
                              )}
                              onKeyDown={(event: any) =>
                                handleShortcutKeyDown(
                                  event,
                                  "newCloneAgentShortcut",
                                )
                              }
                              placeholder={t("settings.shortcuts.placeholder")}
                              readOnly
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                void updateShortcut(
                                  "newCloneAgentShortcut",
                                  null,
                                )
                              }
                            >
                              {t("settings.action.clear")}
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("settings.shortcuts.default", {
                              value: formatShortcut("cmd+alt+n"),
                            })}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>{t("settings.shortcuts.archiveThread")}</Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              className="w-56"
                              value={formatShortcut(
                                shortcutDrafts.archiveThread,
                              )}
                              onKeyDown={(event: any) =>
                                handleShortcutKeyDown(
                                  event,
                                  "archiveThreadShortcut",
                                )
                              }
                              placeholder={t("settings.shortcuts.placeholder")}
                              readOnly
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                void updateShortcut(
                                  "archiveThreadShortcut",
                                  null,
                                )
                              }
                            >
                              {t("settings.action.clear")}
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("settings.shortcuts.default", {
                              value: formatShortcut("cmd+ctrl+a"),
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          {t("settings.shortcuts.composer.title")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {t("settings.shortcuts.composer.subtitle")}
                        </div>
                      </div>
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label>{t("settings.shortcuts.cycleModel")}</Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              className="w-56"
                              value={formatShortcut(shortcutDrafts.model)}
                              onKeyDown={(event: any) =>
                                handleShortcutKeyDown(
                                  event,
                                  "composerModelShortcut",
                                )
                              }
                              placeholder={t("settings.shortcuts.placeholder")}
                              readOnly
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                void updateShortcut(
                                  "composerModelShortcut",
                                  null,
                                )
                              }
                            >
                              {t("settings.action.clear")}
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("settings.shortcuts.pressToSet", {
                              value: formatShortcut("cmd+shift+m"),
                            })}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>{t("settings.shortcuts.cycleAccess")}</Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              className="w-56"
                              value={formatShortcut(shortcutDrafts.access)}
                              onKeyDown={(event: any) =>
                                handleShortcutKeyDown(
                                  event,
                                  "composerAccessShortcut",
                                )
                              }
                              placeholder={t("settings.shortcuts.placeholder")}
                              readOnly
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                void updateShortcut(
                                  "composerAccessShortcut",
                                  null,
                                )
                              }
                            >
                              {t("settings.action.clear")}
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("settings.shortcuts.default", {
                              value: formatShortcut("cmd+shift+a"),
                            })}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>
                            {t("settings.shortcuts.cycleReasoning")}
                          </Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              className="w-56"
                              value={formatShortcut(shortcutDrafts.reasoning)}
                              onKeyDown={(event: any) =>
                                handleShortcutKeyDown(
                                  event,
                                  "composerReasoningShortcut",
                                )
                              }
                              placeholder={t("settings.shortcuts.placeholder")}
                              readOnly
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                void updateShortcut(
                                  "composerReasoningShortcut",
                                  null,
                                )
                              }
                            >
                              {t("settings.action.clear")}
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("settings.shortcuts.default", {
                              value: formatShortcut("cmd+shift+r"),
                            })}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>
                            {t("settings.shortcuts.cycleCollaboration")}
                          </Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              className="w-56"
                              value={formatShortcut(
                                shortcutDrafts.collaboration,
                              )}
                              onKeyDown={(event: any) =>
                                handleShortcutKeyDown(
                                  event,
                                  "composerCollaborationShortcut",
                                )
                              }
                              placeholder={t("settings.shortcuts.placeholder")}
                              readOnly
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                void updateShortcut(
                                  "composerCollaborationShortcut",
                                  null,
                                )
                              }
                            >
                              {t("settings.action.clear")}
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("settings.shortcuts.default", {
                              value: formatShortcut("shift+tab"),
                            })}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>{t("settings.shortcuts.stopRun")}</Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              className="w-56"
                              value={formatShortcut(shortcutDrafts.interrupt)}
                              onKeyDown={(event: any) =>
                                handleShortcutKeyDown(
                                  event,
                                  "interruptShortcut",
                                )
                              }
                              placeholder={t("settings.shortcuts.placeholder")}
                              readOnly
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                void updateShortcut("interruptShortcut", null)
                              }
                            >
                              {t("settings.action.clear")}
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("settings.shortcuts.default", {
                              value: formatShortcut(
                                getDefaultInterruptShortcut(),
                              ),
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          {t("settings.shortcuts.panels.title")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {t("settings.shortcuts.panels.subtitle")}
                        </div>
                      </div>
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label>
                            {t("settings.shortcuts.panels.projects")}
                          </Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              className="w-56"
                              value={formatShortcut(
                                shortcutDrafts.projectsSidebar,
                              )}
                              onKeyDown={(event: any) =>
                                handleShortcutKeyDown(
                                  event,
                                  "toggleProjectsSidebarShortcut",
                                )
                              }
                              placeholder={t("settings.shortcuts.placeholder")}
                              readOnly
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                void updateShortcut(
                                  "toggleProjectsSidebarShortcut",
                                  null,
                                )
                              }
                            >
                              {t("settings.action.clear")}
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("settings.shortcuts.default", {
                              value: formatShortcut("cmd+shift+p"),
                            })}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>{t("settings.shortcuts.panels.git")}</Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              className="w-56"
                              value={formatShortcut(shortcutDrafts.gitSidebar)}
                              onKeyDown={(event: any) =>
                                handleShortcutKeyDown(
                                  event,
                                  "toggleGitSidebarShortcut",
                                )
                              }
                              placeholder={t("settings.shortcuts.placeholder")}
                              readOnly
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                void updateShortcut(
                                  "toggleGitSidebarShortcut",
                                  null,
                                )
                              }
                            >
                              {t("settings.action.clear")}
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("settings.shortcuts.default", {
                              value: formatShortcut("cmd+shift+g"),
                            })}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>{t("settings.shortcuts.panels.debug")}</Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              className="w-56"
                              value={formatShortcut(shortcutDrafts.debugPanel)}
                              onKeyDown={(event: any) =>
                                handleShortcutKeyDown(
                                  event,
                                  "toggleDebugPanelShortcut",
                                )
                              }
                              placeholder={t("settings.shortcuts.placeholder")}
                              readOnly
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                void updateShortcut(
                                  "toggleDebugPanelShortcut",
                                  null,
                                )
                              }
                            >
                              {t("settings.action.clear")}
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("settings.shortcuts.default", {
                              value: formatShortcut("cmd+shift+d"),
                            })}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>
                            {t("settings.shortcuts.panels.terminal")}
                          </Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              className="w-56"
                              value={formatShortcut(shortcutDrafts.terminal)}
                              onKeyDown={(event: any) =>
                                handleShortcutKeyDown(
                                  event,
                                  "toggleTerminalShortcut",
                                )
                              }
                              placeholder={t("settings.shortcuts.placeholder")}
                              readOnly
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                void updateShortcut(
                                  "toggleTerminalShortcut",
                                  null,
                                )
                              }
                            >
                              {t("settings.action.clear")}
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("settings.shortcuts.default", {
                              value: formatShortcut("cmd+shift+t"),
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          {t("settings.shortcuts.navigation.title")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {t("settings.shortcuts.navigation.subtitle")}
                        </div>
                      </div>
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label>
                            {t("settings.shortcuts.navigation.nextAgent")}
                          </Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              className="w-56"
                              value={formatShortcut(
                                shortcutDrafts.cycleAgentNext,
                              )}
                              onKeyDown={(event: any) =>
                                handleShortcutKeyDown(
                                  event,
                                  "cycleAgentNextShortcut",
                                )
                              }
                              placeholder={t("settings.shortcuts.placeholder")}
                              readOnly
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                void updateShortcut(
                                  "cycleAgentNextShortcut",
                                  null,
                                )
                              }
                            >
                              {t("settings.action.clear")}
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("settings.shortcuts.default", {
                              value: formatShortcut("cmd+ctrl+down"),
                            })}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>
                            {t("settings.shortcuts.navigation.prevAgent")}
                          </Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              className="w-56"
                              value={formatShortcut(
                                shortcutDrafts.cycleAgentPrev,
                              )}
                              onKeyDown={(event: any) =>
                                handleShortcutKeyDown(
                                  event,
                                  "cycleAgentPrevShortcut",
                                )
                              }
                              placeholder={t("settings.shortcuts.placeholder")}
                              readOnly
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                void updateShortcut(
                                  "cycleAgentPrevShortcut",
                                  null,
                                )
                              }
                            >
                              {t("settings.action.clear")}
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("settings.shortcuts.default", {
                              value: formatShortcut("cmd+ctrl+up"),
                            })}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>
                            {t("settings.shortcuts.navigation.nextWorkspace")}
                          </Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              className="w-56"
                              value={formatShortcut(
                                shortcutDrafts.cycleWorkspaceNext,
                              )}
                              onKeyDown={(event: any) =>
                                handleShortcutKeyDown(
                                  event,
                                  "cycleWorkspaceNextShortcut",
                                )
                              }
                              placeholder={t("settings.shortcuts.placeholder")}
                              readOnly
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                void updateShortcut(
                                  "cycleWorkspaceNextShortcut",
                                  null,
                                )
                              }
                            >
                              {t("settings.action.clear")}
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("settings.shortcuts.default", {
                              value: formatShortcut("cmd+shift+down"),
                            })}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>
                            {t("settings.shortcuts.navigation.prevWorkspace")}
                          </Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              className="w-56"
                              value={formatShortcut(
                                shortcutDrafts.cycleWorkspacePrev,
                              )}
                              onKeyDown={(event: any) =>
                                handleShortcutKeyDown(
                                  event,
                                  "cycleWorkspacePrevShortcut",
                                )
                              }
                              placeholder={t("settings.shortcuts.placeholder")}
                              readOnly
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                void updateShortcut(
                                  "cycleWorkspacePrevShortcut",
                                  null,
                                )
                              }
                            >
                              {t("settings.action.clear")}
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("settings.shortcuts.default", {
                              value: formatShortcut("cmd+shift+up"),
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </SettingsSection>
                </div>
              </TabsContent>
  );
}

