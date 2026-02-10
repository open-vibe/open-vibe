import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import { SettingsSection } from "../SettingsSection";


export function ExperimentalTabSection(props: any) {
  const {t, hasCodexHomeOverrides, fileManagerLabel, handleOpenConfig, openInFileManagerLabel, openConfigError, appSettings, onUpdateAppSettings, yunyiTokenDraft, setYunyiTokenDraft, handleCommitYunyiToken, happyServerDraft, setHappyServerDraft, handleCommitHappyServer} = props;

  return (
<TabsContent value="experimental" className="mt-0">
                <div className="space-y-4">
                  <SettingsSection
                    title={t("settings.experimental.title")}
                    description={t("settings.experimental.subtitle")}
                  >
                    <div className="space-y-4">
                      {hasCodexHomeOverrides && (
                        <div className="text-sm text-muted-foreground">
                          {t("settings.experimental.overridesNotice")}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-border/60 p-3">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {t("settings.experimental.configFile.title")}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.experimental.configFile.subtitle", {
                              label: fileManagerLabel,
                            })}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleOpenConfig}
                        >
                          {openInFileManagerLabel}
                        </Button>
                      </div>
                      {openConfigError && (
                        <div className="text-sm text-destructive">
                          {openConfigError}
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                        <div className="space-y-1">
                          <Label htmlFor="experimental-collab">
                            {t("settings.experimental.multiAgent.title")}
                          </Label>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.experimental.multiAgent.subtitle")}
                          </div>
                        </div>
                        <Switch
                          id="experimental-collab"
                          checked={appSettings.experimentalCollabEnabled}
                          onCheckedChange={(value: any) =>
                            void onUpdateAppSettings({
                              ...appSettings,
                              experimentalCollabEnabled: value,
                            })
                          }
                        />
                      </div>
                      <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                        <div className="space-y-1">
                          <Label htmlFor="experimental-collab-modes">
                            {t(
                              "settings.experimental.collaborationModes.title",
                            )}
                          </Label>
                          <div className="text-sm text-muted-foreground">
                            {t(
                              "settings.experimental.collaborationModes.subtitle",
                            )}
                          </div>
                        </div>
                        <Switch
                          id="experimental-collab-modes"
                          checked={
                            appSettings.experimentalCollaborationModesEnabled
                          }
                          onCheckedChange={(value: any) =>
                            void onUpdateAppSettings({
                              ...appSettings,
                              experimentalCollaborationModesEnabled: value,
                            })
                          }
                        />
                      </div>
                      <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                        <div className="space-y-1">
                          <Label htmlFor="experimental-unified">
                            {t(
                              "settings.experimental.backgroundTerminal.title",
                            )}
                          </Label>
                          <div className="text-sm text-muted-foreground">
                            {t(
                              "settings.experimental.backgroundTerminal.subtitle",
                            )}
                          </div>
                        </div>
                        <Switch
                          id="experimental-unified"
                          checked={appSettings.experimentalUnifiedExecEnabled}
                          onCheckedChange={(value: any) =>
                            void onUpdateAppSettings({
                              ...appSettings,
                              experimentalUnifiedExecEnabled: value,
                            })
                          }
                        />
                      </div>
                      <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                        <div className="space-y-1">
                          <Label htmlFor="experimental-thread-resume-stream">
                            {t(
                              "settings.experimental.threadResumeStreaming.title",
                            )}
                          </Label>
                          <div className="text-sm text-muted-foreground">
                            {t(
                              "settings.experimental.threadResumeStreaming.subtitle",
                            )}
                          </div>
                        </div>
                        <Switch
                          id="experimental-thread-resume-stream"
                          checked={
                            appSettings.experimentalThreadResumeStreamingEnabled
                          }
                          onCheckedChange={(value: any) =>
                            void onUpdateAppSettings({
                              ...appSettings,
                              experimentalThreadResumeStreamingEnabled: value,
                            })
                          }
                        />
                      </div>
                      <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                        <div className="space-y-1">
                          <Label htmlFor="experimental-steer">
                            {t("settings.experimental.steer.title")}
                          </Label>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.experimental.steer.subtitle")}
                          </div>
                        </div>
                        <Switch
                          id="experimental-steer"
                          checked={appSettings.experimentalSteerEnabled}
                          onCheckedChange={(value: any) =>
                            void onUpdateAppSettings({
                              ...appSettings,
                              experimentalSteerEnabled: value,
                            })
                          }
                        />
                      </div>
                      <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                        <div className="space-y-1">
                          <Label htmlFor="experimental-yunyi">
                            {t("settings.experimental.yunyi.title")}
                          </Label>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.experimental.yunyi.subtitle")}
                          </div>
                        </div>
                        <Switch
                          id="experimental-yunyi"
                          checked={appSettings.experimentalYunyiEnabled}
                          onCheckedChange={(value: any) =>
                            void onUpdateAppSettings({
                              ...appSettings,
                              experimentalYunyiEnabled: value,
                            })
                          }
                        />
                      </div>
                      {appSettings.experimentalYunyiEnabled && (
                        <div className="space-y-2 rounded-md border border-border/60 p-3">
                          <Label htmlFor="experimental-yunyi-token">
                            {t("settings.experimental.yunyi.token.label")}
                          </Label>
                          <Input
                            id="experimental-yunyi-token"
                            type="password"
                            value={yunyiTokenDraft}
                            placeholder={t(
                              "settings.experimental.yunyi.token.placeholder",
                            )}
                            onChange={(event: any) =>
                              setYunyiTokenDraft(event.target.value)
                            }
                            onBlur={() => {
                              void handleCommitYunyiToken();
                            }}
                            onKeyDown={(event: any) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void handleCommitYunyiToken();
                              }
                            }}
                          />
                          <div className="text-sm text-muted-foreground">
                            {t("settings.experimental.yunyi.token.help")}
                          </div>
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                        <div className="space-y-1">
                          <Label htmlFor="experimental-happy">
                            {t("settings.experimental.happy.title")}
                          </Label>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.experimental.happy.subtitle")}
                          </div>
                        </div>
                        <Switch
                          id="experimental-happy"
                          checked={appSettings.happyEnabled}
                          onCheckedChange={(value: any) =>
                            void onUpdateAppSettings({
                              ...appSettings,
                              happyEnabled: value,
                            })
                          }
                        />
                      </div>
                      {appSettings.happyEnabled && (
                        <div className="space-y-3 rounded-md border border-border/60 p-3">
                          <div className="space-y-2">
                            <Label htmlFor="experimental-happy-server">
                              {t("settings.experimental.happy.server.label")}
                            </Label>
                            <Input
                              id="experimental-happy-server"
                              type="url"
                              value={happyServerDraft}
                              placeholder={t(
                                "settings.experimental.happy.server.placeholder",
                              )}
                              onChange={(event: any) =>
                                setHappyServerDraft(event.target.value)
                              }
                              onBlur={() => {
                                void handleCommitHappyServer();
                              }}
                              onKeyDown={(event: any) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void handleCommitHappyServer();
                                }
                              }}
                            />
                            <div className="text-sm text-muted-foreground">
                              {t("settings.experimental.happy.server.help")}
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.experimental.happy.credentialsHelp")}
                          </div>
                        </div>
                      )}
                    </div>
                  </SettingsSection>
                </div>
              </TabsContent>
  );
}

