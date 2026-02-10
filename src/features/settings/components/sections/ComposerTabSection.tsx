import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import { SettingsSection } from "../SettingsSection";

export function ComposerTabSection(props: any) {
  const {t, appSettings, handleComposerPresetChange, composerPresetLabels, onUpdateAppSettings} = props;

  return (
<TabsContent value="composer" className="mt-0">
                <div className="space-y-4">
                  <SettingsSection
                    title={t("settings.composer.title")}
                    description={t("settings.composer.subtitle")}
                  >
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          {t("settings.composer.presets.title")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {t("settings.composer.presets.subtitle")}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="composer-preset">
                          {t("settings.composer.presets.label")}
                        </Label>
                        <Select
                          value={appSettings.composerEditorPreset}
                          onValueChange={(value: any) =>
                            handleComposerPresetChange(value as any)
                          }
                        >
                          <SelectTrigger id="composer-preset">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(composerPresetLabels).map(
                              ([preset, label]) => (
                                <SelectItem key={preset} value={preset}>
                                  {label as string}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                        <div className="text-sm text-muted-foreground">
                          {t("settings.composer.presets.help")}
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          {t("settings.composer.sendMode.title")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {t("settings.composer.sendMode.subtitle")}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="composer-send-mode">
                          {t("settings.composer.sendMode.label")}
                        </Label>
                        <Select
                          value={appSettings.composerSendBehavior}
                          onValueChange={(value: any) =>
                            void onUpdateAppSettings({
                              ...appSettings,
                              composerSendBehavior:
                                value as any,
                            })
                          }
                        >
                          <SelectTrigger id="composer-send-mode">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="enter">
                              {t("settings.composer.sendMode.enter")}
                            </SelectItem>
                            <SelectItem value="ctrl-enter">
                              {t("settings.composer.sendMode.ctrlEnter")}
                            </SelectItem>
                            <SelectItem value="smart">
                              {t("settings.composer.sendMode.smart")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                        <div className="space-y-1">
                          <Label htmlFor="composer-send-confirm">
                            {t("settings.composer.sendConfirm.title")}
                          </Label>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.composer.sendConfirm.subtitle")}
                          </div>
                        </div>
                        <Switch
                          id="composer-send-confirm"
                          checked={appSettings.composerSendConfirmationEnabled}
                          onCheckedChange={(value: any) =>
                            void onUpdateAppSettings({
                              ...appSettings,
                              composerSendConfirmationEnabled: value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <div className="text-sm font-medium">
                        {t("settings.composer.codeFences.title")}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                          <div className="space-y-1">
                            <Label htmlFor="composer-fence-space">
                              {t(
                                "settings.composer.codeFences.expandSpace.title",
                              )}
                            </Label>
                            <div className="text-sm text-muted-foreground">
                              {t(
                                "settings.composer.codeFences.expandSpace.subtitle",
                              )}
                            </div>
                          </div>
                          <Switch
                            id="composer-fence-space"
                            checked={appSettings.composerFenceExpandOnSpace}
                            onCheckedChange={(value: any) =>
                              void onUpdateAppSettings({
                                ...appSettings,
                                composerFenceExpandOnSpace: value,
                              })
                            }
                          />
                        </div>
                        <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                          <div className="space-y-1">
                            <Label htmlFor="composer-fence-enter">
                              {t(
                                "settings.composer.codeFences.expandEnter.title",
                              )}
                            </Label>
                            <div className="text-sm text-muted-foreground">
                              {t(
                                "settings.composer.codeFences.expandEnter.subtitle",
                              )}
                            </div>
                          </div>
                          <Switch
                            id="composer-fence-enter"
                            checked={appSettings.composerFenceExpandOnEnter}
                            onCheckedChange={(value: any) =>
                              void onUpdateAppSettings({
                                ...appSettings,
                                composerFenceExpandOnEnter: value,
                              })
                            }
                          />
                        </div>
                        <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                          <div className="space-y-1">
                            <Label htmlFor="composer-fence-language">
                              {t(
                                "settings.composer.codeFences.languageTags.title",
                              )}
                            </Label>
                            <div className="text-sm text-muted-foreground">
                              {t(
                                "settings.composer.codeFences.languageTags.subtitle",
                              )}
                            </div>
                          </div>
                          <Switch
                            id="composer-fence-language"
                            checked={appSettings.composerFenceLanguageTags}
                            onCheckedChange={(value: any) =>
                              void onUpdateAppSettings({
                                ...appSettings,
                                composerFenceLanguageTags: value,
                              })
                            }
                          />
                        </div>
                        <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                          <div className="space-y-1">
                            <Label htmlFor="composer-fence-wrap">
                              {t(
                                "settings.composer.codeFences.wrapSelection.title",
                              )}
                            </Label>
                            <div className="text-sm text-muted-foreground">
                              {t(
                                "settings.composer.codeFences.wrapSelection.subtitle",
                              )}
                            </div>
                          </div>
                          <Switch
                            id="composer-fence-wrap"
                            checked={appSettings.composerFenceWrapSelection}
                            onCheckedChange={(value: any) =>
                              void onUpdateAppSettings({
                                ...appSettings,
                                composerFenceWrapSelection: value,
                              })
                            }
                          />
                        </div>
                        <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                          <div className="space-y-1">
                            <Label htmlFor="composer-fence-copy">
                              {t(
                                "settings.composer.codeFences.copyWithoutFences.title",
                              )}
                            </Label>
                            <div className="text-sm text-muted-foreground">
                              {t(
                                "settings.composer.codeFences.copyWithoutFences.subtitle",
                              )}
                            </div>
                          </div>
                          <Switch
                            id="composer-fence-copy"
                            checked={
                              appSettings.composerCodeBlockCopyUseModifier
                            }
                            onCheckedChange={(value: any) =>
                              void onUpdateAppSettings({
                                ...appSettings,
                                composerCodeBlockCopyUseModifier: value,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <div className="text-sm font-medium">
                        {t("settings.composer.pasting.title")}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                          <div className="space-y-1">
                            <Label htmlFor="composer-paste-multiline">
                              {t(
                                "settings.composer.pasting.autoWrapMultiline.title",
                              )}
                            </Label>
                            <div className="text-sm text-muted-foreground">
                              {t(
                                "settings.composer.pasting.autoWrapMultiline.subtitle",
                              )}
                            </div>
                          </div>
                          <Switch
                            id="composer-paste-multiline"
                            checked={
                              appSettings.composerFenceAutoWrapPasteMultiline
                            }
                            onCheckedChange={(value: any) =>
                              void onUpdateAppSettings({
                                ...appSettings,
                                composerFenceAutoWrapPasteMultiline: value,
                              })
                            }
                          />
                        </div>
                        <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                          <div className="space-y-1">
                            <Label htmlFor="composer-paste-codelike">
                              {t(
                                "settings.composer.pasting.autoWrapCodeLike.title",
                              )}
                            </Label>
                            <div className="text-sm text-muted-foreground">
                              {t(
                                "settings.composer.pasting.autoWrapCodeLike.subtitle",
                              )}
                            </div>
                          </div>
                          <Switch
                            id="composer-paste-codelike"
                            checked={
                              appSettings.composerFenceAutoWrapPasteCodeLike
                            }
                            onCheckedChange={(value: any) =>
                              void onUpdateAppSettings({
                                ...appSettings,
                                composerFenceAutoWrapPasteCodeLike: value,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <div className="text-sm font-medium">
                        {t("settings.composer.lists.title")}
                      </div>
                      <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                        <div className="space-y-1">
                          <Label htmlFor="composer-list-continuation">
                            {t("settings.composer.lists.continue.title")}
                          </Label>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.composer.lists.continue.subtitle")}
                          </div>
                        </div>
                        <Switch
                          id="composer-list-continuation"
                          checked={appSettings.composerListContinuation}
                          onCheckedChange={(value: any) =>
                            void onUpdateAppSettings({
                              ...appSettings,
                              composerListContinuation: value,
                            })
                          }
                        />
                      </div>
                    </div>
                  </SettingsSection>
                </div>
              </TabsContent>
  );
}

