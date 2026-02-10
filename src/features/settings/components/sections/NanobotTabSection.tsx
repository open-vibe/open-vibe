import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import { SettingsSection } from "../SettingsSection";

export function NanobotTabSection(props: any) {
  const {t, appSettings, onUpdateAppSettings, nextNanobotClientId, nextNanobotClientSecret, nextNanobotAllowFrom, nextNanobotEmailImapHost, nextNanobotEmailImapPort, nextNanobotEmailImapUsername, nextNanobotEmailImapPassword, nextNanobotEmailImapMailbox, nextNanobotEmailSmtpHost, nextNanobotEmailSmtpPort, nextNanobotEmailSmtpUsername, nextNanobotEmailSmtpPassword, nextNanobotEmailFromAddress, nextNanobotEmailAllowFrom, nextNanobotEmailPollIntervalSeconds, nextNanobotQqAppId, nextNanobotQqSecret, nextNanobotQqAllowFrom, nanobotClientIdDraft, setNanobotClientIdDraft, nanobotClientSecretDraft, setNanobotClientSecretDraft, nanobotAllowFromDraft, setNanobotAllowFromDraft, handleTestNanobotDingTalk, nanobotTestState, nanobotEmailImapHostDraft, setNanobotEmailImapHostDraft, nanobotEmailImapPortDraft, setNanobotEmailImapPortDraft, nanobotEmailImapUsernameDraft, setNanobotEmailImapUsernameDraft, nanobotEmailImapPasswordDraft, setNanobotEmailImapPasswordDraft, nanobotEmailImapMailboxDraft, setNanobotEmailImapMailboxDraft, nanobotEmailSmtpHostDraft, setNanobotEmailSmtpHostDraft, nanobotEmailSmtpPortDraft, setNanobotEmailSmtpPortDraft, nanobotEmailSmtpUsernameDraft, setNanobotEmailSmtpUsernameDraft, nanobotEmailSmtpPasswordDraft, setNanobotEmailSmtpPasswordDraft, nanobotEmailFromAddressDraft, setNanobotEmailFromAddressDraft, nanobotEmailPollIntervalDraft, setNanobotEmailPollIntervalDraft, nanobotEmailAllowFromDraft, setNanobotEmailAllowFromDraft, nanobotQqAppIdDraft, setNanobotQqAppIdDraft, nanobotQqSecretDraft, setNanobotQqSecretDraft, nanobotQqAllowFromDraft, setNanobotQqAllowFromDraft, nanobotDirty, handleSaveNanobotSettings, isSavingSettings, handleClearNanobotThreads, nanobotCleanupState, nanobotConfigPath, nanobotConfigPathError, cn} = props;

  return (
<TabsContent value="nanobot" className="mt-0">
                <div className="space-y-4">
                  <SettingsSection
                    title={t("settings.nanobot.title")}
                    description={t("settings.nanobot.subtitle")}
                    headerAction={
                      <div className="flex flex-col items-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={handleClearNanobotThreads}
                          disabled={
                            !handleClearNanobotThreads ||
                            nanobotCleanupState.status === "running"
                          }
                        >
                          {nanobotCleanupState.status === "running"
                            ? t("settings.action.running")
                            : t("settings.nanobot.cleanup.button")}
                        </Button>
                        <div className="max-w-56 text-right text-[11px] text-muted-foreground">
                          {t("settings.nanobot.cleanup.subtitle")}
                        </div>
                      </div>
                    }
                  >
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="nanobot-mode">
                          {t("settings.nanobot.mode.label")}
                        </Label>
                        <Select
                          value={appSettings.nanobotMode}
                          onValueChange={(value: any) => {
                            void onUpdateAppSettings({
                              ...appSettings,
                              nanobotMode: value as any,
                            });
                          }}
                        >
                          <SelectTrigger
                            id="nanobot-mode"
                            className="w-full max-w-[280px]"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bridge">
                              {t("settings.nanobot.mode.bridge")}
                            </SelectItem>
                            <SelectItem value="agent">
                              {t("settings.nanobot.mode.agent")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="text-xs text-muted-foreground">
                          {appSettings.nanobotMode === "bridge"
                            ? t("settings.nanobot.mode.bridgeHelp")
                            : t("settings.nanobot.mode.agentHelp")}
                        </div>
                      </div>
                      <div className="flex items-start justify-between gap-3 rounded-md border border-border/60 p-3">
                        <div>
                          <div className="text-sm font-medium">
                            {t("settings.nanobot.enable.title")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("settings.nanobot.enable.subtitle")}
                          </div>
                        </div>
                        <Switch
                          checked={appSettings.nanobotEnabled}
                          onCheckedChange={(checked: any) => {
                            void onUpdateAppSettings({
                              ...appSettings,
                              nanobotEnabled: checked,
                              nanobotDingTalkClientId: nextNanobotClientId,
                              nanobotDingTalkClientSecret: nextNanobotClientSecret,
                              nanobotDingTalkAllowFrom: nextNanobotAllowFrom,
                              nanobotEmailImapHost: nextNanobotEmailImapHost,
                              nanobotEmailImapPort: nextNanobotEmailImapPort,
                              nanobotEmailImapUsername: nextNanobotEmailImapUsername,
                              nanobotEmailImapPassword: nextNanobotEmailImapPassword,
                              nanobotEmailImapMailbox: nextNanobotEmailImapMailbox,
                              nanobotEmailSmtpHost: nextNanobotEmailSmtpHost,
                              nanobotEmailSmtpPort: nextNanobotEmailSmtpPort,
                              nanobotEmailSmtpUsername: nextNanobotEmailSmtpUsername,
                              nanobotEmailSmtpPassword: nextNanobotEmailSmtpPassword,
                              nanobotEmailFromAddress: nextNanobotEmailFromAddress,
                              nanobotEmailAllowFrom: nextNanobotEmailAllowFrom,
                              nanobotEmailPollIntervalSeconds:
                                nextNanobotEmailPollIntervalSeconds,
                              nanobotQqAppId: nextNanobotQqAppId,
                              nanobotQqSecret: nextNanobotQqSecret,
                              nanobotQqAllowFrom: nextNanobotQqAllowFrom,
                            });
                          }}
                        />
                      </div>
                      <div className="flex items-start justify-between gap-3 rounded-md border border-border/60 p-3">
                        <div>
                          <div className="text-sm font-medium">
                            {t("settings.nanobot.sessionMemory.title")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("settings.nanobot.sessionMemory.subtitle")}
                          </div>
                        </div>
                        <Switch
                          checked={appSettings.nanobotSessionMemoryEnabled}
                          onCheckedChange={(checked: any) => {
                            void onUpdateAppSettings({
                              ...appSettings,
                              nanobotSessionMemoryEnabled: checked,
                            });
                          }}
                        />
                      </div>
                      <div className="rounded-md border border-border/60 p-3">
                        <div className="mb-3 text-sm font-medium">
                          {t("settings.nanobot.dingtalk.sectionTitle")}
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3 rounded-md border border-border/60 p-3">
                            <div>
                              <div className="text-sm font-medium">
                                {t("settings.nanobot.dingtalk.enable.title")}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {t("settings.nanobot.dingtalk.enable.subtitle")}
                              </div>
                            </div>
                            <Switch
                              checked={appSettings.nanobotDingTalkEnabled}
                              onCheckedChange={(checked: any) => {
                                void onUpdateAppSettings({
                                  ...appSettings,
                                  nanobotDingTalkEnabled: checked,
                                  nanobotDingTalkClientId: nextNanobotClientId,
                                  nanobotDingTalkClientSecret:
                                    nextNanobotClientSecret,
                                  nanobotDingTalkAllowFrom: nextNanobotAllowFrom,
                                  nanobotEmailImapHost: nextNanobotEmailImapHost,
                                  nanobotEmailImapPort: nextNanobotEmailImapPort,
                                  nanobotEmailImapUsername:
                                    nextNanobotEmailImapUsername,
                                  nanobotEmailImapPassword:
                                    nextNanobotEmailImapPassword,
                                  nanobotEmailImapMailbox:
                                    nextNanobotEmailImapMailbox,
                                  nanobotEmailSmtpHost: nextNanobotEmailSmtpHost,
                                  nanobotEmailSmtpPort: nextNanobotEmailSmtpPort,
                                  nanobotEmailSmtpUsername:
                                    nextNanobotEmailSmtpUsername,
                                  nanobotEmailSmtpPassword:
                                    nextNanobotEmailSmtpPassword,
                                  nanobotEmailFromAddress:
                                    nextNanobotEmailFromAddress,
                                  nanobotEmailAllowFrom:
                                    nextNanobotEmailAllowFrom,
                                  nanobotEmailPollIntervalSeconds:
                                    nextNanobotEmailPollIntervalSeconds,
                                  nanobotQqAppId: nextNanobotQqAppId,
                                  nanobotQqSecret: nextNanobotQqSecret,
                                  nanobotQqAllowFrom: nextNanobotQqAllowFrom,
                                });
                              }}
                            />
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="nanobot-dingtalk-client-id">
                                {t("settings.nanobot.dingtalk.clientId.label")}
                              </Label>
                              <Input
                                id="nanobot-dingtalk-client-id"
                                value={nanobotClientIdDraft}
                                placeholder={t(
                                  "settings.nanobot.dingtalk.clientId.placeholder",
                                )}
                                onChange={(event: any) =>
                                  setNanobotClientIdDraft(event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="nanobot-dingtalk-client-secret">
                                {t(
                                  "settings.nanobot.dingtalk.clientSecret.label",
                                )}
                              </Label>
                              <Input
                                id="nanobot-dingtalk-client-secret"
                                type="password"
                                value={nanobotClientSecretDraft}
                                placeholder={t(
                                  "settings.nanobot.dingtalk.clientSecret.placeholder",
                                )}
                                onChange={(event: any) =>
                                  setNanobotClientSecretDraft(event.target.value)
                                }
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="nanobot-dingtalk-allow-from">
                              {t("settings.nanobot.dingtalk.allowFrom.label")}
                            </Label>
                            <Input
                              id="nanobot-dingtalk-allow-from"
                              value={nanobotAllowFromDraft}
                              placeholder={t(
                                "settings.nanobot.dingtalk.allowFrom.placeholder",
                              )}
                              onChange={(event: any) =>
                                setNanobotAllowFromDraft(event.target.value)
                              }
                            />
                            <div className="text-xs text-muted-foreground">
                              {t("settings.nanobot.dingtalk.allowFrom.help")}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleTestNanobotDingTalk}
                              disabled={nanobotTestState.status === "running"}
                            >
                              {nanobotTestState.status === "running"
                                ? t("settings.action.running")
                                : t("settings.action.testConnection")}
                            </Button>
                          </div>
                          {nanobotTestState.result ? (
                            <div
                              className={cn(
                                "rounded-md border border-border/60 p-3 text-sm",
                                nanobotTestState.result.ok
                                  ? "border-emerald-500/40 bg-emerald-50/40"
                                  : "border-destructive/40 bg-destructive/10",
                              )}
                            >
                              <div>{nanobotTestState.result.message}</div>
                              {nanobotTestState.result.endpoint ? (
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {t("settings.nanobot.test.endpoint", {
                                    value: nanobotTestState.result.endpoint,
                                  })}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="rounded-md border border-border/60 p-3">
                        <div className="mb-3 text-sm font-medium">
                          {t("settings.nanobot.email.sectionTitle")}
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3 rounded-md border border-border/60 p-3">
                            <div>
                              <div className="text-sm font-medium">
                                {t("settings.nanobot.email.enable.title")}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {t("settings.nanobot.email.enable.subtitle")}
                              </div>
                            </div>
                            <Switch
                              checked={appSettings.nanobotEmailEnabled}
                              onCheckedChange={(checked: any) => {
                                void onUpdateAppSettings({
                                  ...appSettings,
                                  nanobotEmailEnabled: checked,
                                  nanobotDingTalkClientId: nextNanobotClientId,
                                  nanobotDingTalkClientSecret:
                                    nextNanobotClientSecret,
                                  nanobotDingTalkAllowFrom: nextNanobotAllowFrom,
                                  nanobotEmailImapHost: nextNanobotEmailImapHost,
                                  nanobotEmailImapPort: nextNanobotEmailImapPort,
                                  nanobotEmailImapUsername:
                                    nextNanobotEmailImapUsername,
                                  nanobotEmailImapPassword:
                                    nextNanobotEmailImapPassword,
                                  nanobotEmailImapMailbox:
                                    nextNanobotEmailImapMailbox,
                                  nanobotEmailSmtpHost: nextNanobotEmailSmtpHost,
                                  nanobotEmailSmtpPort: nextNanobotEmailSmtpPort,
                                  nanobotEmailSmtpUsername:
                                    nextNanobotEmailSmtpUsername,
                                  nanobotEmailSmtpPassword:
                                    nextNanobotEmailSmtpPassword,
                                  nanobotEmailFromAddress:
                                    nextNanobotEmailFromAddress,
                                  nanobotEmailAllowFrom:
                                    nextNanobotEmailAllowFrom,
                                  nanobotEmailPollIntervalSeconds:
                                    nextNanobotEmailPollIntervalSeconds,
                                  nanobotQqAppId: nextNanobotQqAppId,
                                  nanobotQqSecret: nextNanobotQqSecret,
                                  nanobotQqAllowFrom: nextNanobotQqAllowFrom,
                                });
                              }}
                            />
                          </div>
                          <div className="flex items-start justify-between gap-3 rounded-md border border-border/60 p-3">
                            <div>
                              <div className="text-sm font-medium">
                                {t("settings.nanobot.email.consent.title")}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {t("settings.nanobot.email.consent.subtitle")}
                              </div>
                            </div>
                            <Switch
                              checked={appSettings.nanobotEmailConsentGranted}
                              onCheckedChange={(checked: any) => {
                                void onUpdateAppSettings({
                                  ...appSettings,
                                  nanobotEmailConsentGranted: checked,
                                });
                              }}
                            />
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="nanobot-email-imap-host">
                                {t("settings.nanobot.email.imapHost.label")}
                              </Label>
                              <Input
                                id="nanobot-email-imap-host"
                                value={nanobotEmailImapHostDraft}
                                placeholder={t(
                                  "settings.nanobot.email.imapHost.placeholder",
                                )}
                                onChange={(event: any) =>
                                  setNanobotEmailImapHostDraft(
                                    event.target.value,
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="nanobot-email-imap-port">
                                {t("settings.nanobot.email.imapPort.label")}
                              </Label>
                              <Input
                                id="nanobot-email-imap-port"
                                type="number"
                                min={1}
                                max={65535}
                                value={nanobotEmailImapPortDraft}
                                onChange={(event: any) =>
                                  setNanobotEmailImapPortDraft(
                                    event.target.value,
                                  )
                                }
                              />
                            </div>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="nanobot-email-imap-username">
                                {t("settings.nanobot.email.imapUsername.label")}
                              </Label>
                              <Input
                                id="nanobot-email-imap-username"
                                value={nanobotEmailImapUsernameDraft}
                                onChange={(event: any) =>
                                  setNanobotEmailImapUsernameDraft(
                                    event.target.value,
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="nanobot-email-imap-password">
                                {t("settings.nanobot.email.imapPassword.label")}
                              </Label>
                              <Input
                                id="nanobot-email-imap-password"
                                type="password"
                                value={nanobotEmailImapPasswordDraft}
                                onChange={(event: any) =>
                                  setNanobotEmailImapPasswordDraft(
                                    event.target.value,
                                  )
                                }
                              />
                            </div>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="nanobot-email-imap-mailbox">
                                {t("settings.nanobot.email.imapMailbox.label")}
                              </Label>
                              <Input
                                id="nanobot-email-imap-mailbox"
                                value={nanobotEmailImapMailboxDraft}
                                placeholder="INBOX"
                                onChange={(event: any) =>
                                  setNanobotEmailImapMailboxDraft(
                                    event.target.value,
                                  )
                                }
                              />
                            </div>
                            <div className="flex items-start justify-between gap-3 rounded-md border border-border/60 p-3">
                              <div>
                                <div className="text-sm font-medium">
                                  {t("settings.nanobot.email.imapUseSsl.title")}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {t(
                                    "settings.nanobot.email.imapUseSsl.subtitle",
                                  )}
                                </div>
                              </div>
                              <Switch
                                checked={appSettings.nanobotEmailImapUseSsl}
                                onCheckedChange={(checked: any) => {
                                  void onUpdateAppSettings({
                                    ...appSettings,
                                    nanobotEmailImapUseSsl: checked,
                                  });
                                }}
                              />
                            </div>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="nanobot-email-smtp-host">
                                {t("settings.nanobot.email.smtpHost.label")}
                              </Label>
                              <Input
                                id="nanobot-email-smtp-host"
                                value={nanobotEmailSmtpHostDraft}
                                placeholder={t(
                                  "settings.nanobot.email.smtpHost.placeholder",
                                )}
                                onChange={(event: any) =>
                                  setNanobotEmailSmtpHostDraft(
                                    event.target.value,
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="nanobot-email-smtp-port">
                                {t("settings.nanobot.email.smtpPort.label")}
                              </Label>
                              <Input
                                id="nanobot-email-smtp-port"
                                type="number"
                                min={1}
                                max={65535}
                                value={nanobotEmailSmtpPortDraft}
                                onChange={(event: any) =>
                                  setNanobotEmailSmtpPortDraft(
                                    event.target.value,
                                  )
                                }
                              />
                            </div>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="nanobot-email-smtp-username">
                                {t("settings.nanobot.email.smtpUsername.label")}
                              </Label>
                              <Input
                                id="nanobot-email-smtp-username"
                                value={nanobotEmailSmtpUsernameDraft}
                                onChange={(event: any) =>
                                  setNanobotEmailSmtpUsernameDraft(
                                    event.target.value,
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="nanobot-email-smtp-password">
                                {t("settings.nanobot.email.smtpPassword.label")}
                              </Label>
                              <Input
                                id="nanobot-email-smtp-password"
                                type="password"
                                value={nanobotEmailSmtpPasswordDraft}
                                onChange={(event: any) =>
                                  setNanobotEmailSmtpPasswordDraft(
                                    event.target.value,
                                  )
                                }
                              />
                            </div>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="nanobot-email-from-address">
                                {t("settings.nanobot.email.fromAddress.label")}
                              </Label>
                              <Input
                                id="nanobot-email-from-address"
                                value={nanobotEmailFromAddressDraft}
                                placeholder="you@example.com"
                                onChange={(event: any) =>
                                  setNanobotEmailFromAddressDraft(
                                    event.target.value,
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="nanobot-email-poll-interval">
                                {t(
                                  "settings.nanobot.email.pollIntervalSeconds.label",
                                )}
                              </Label>
                              <Input
                                id="nanobot-email-poll-interval"
                                type="number"
                                min={5}
                                step={1}
                                value={nanobotEmailPollIntervalDraft}
                                onChange={(event: any) =>
                                  setNanobotEmailPollIntervalDraft(
                                    event.target.value,
                                  )
                                }
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="nanobot-email-allow-from">
                              {t("settings.nanobot.email.allowFrom.label")}
                            </Label>
                            <Input
                              id="nanobot-email-allow-from"
                              value={nanobotEmailAllowFromDraft}
                              placeholder={t(
                                "settings.nanobot.email.allowFrom.placeholder",
                              )}
                              onChange={(event: any) =>
                                setNanobotEmailAllowFromDraft(
                                  event.target.value,
                                )
                              }
                            />
                            <div className="text-xs text-muted-foreground">
                              {t("settings.nanobot.email.allowFrom.help")}
                            </div>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="flex items-start justify-between gap-3 rounded-md border border-border/60 p-3">
                              <div>
                                <div className="text-sm font-medium">
                                  {t("settings.nanobot.email.smtpUseTls.title")}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {t(
                                    "settings.nanobot.email.smtpUseTls.subtitle",
                                  )}
                                </div>
                              </div>
                              <Switch
                                checked={appSettings.nanobotEmailSmtpUseTls}
                                onCheckedChange={(checked: any) => {
                                  void onUpdateAppSettings({
                                    ...appSettings,
                                    nanobotEmailSmtpUseTls: checked,
                                  });
                                }}
                              />
                            </div>
                            <div className="flex items-start justify-between gap-3 rounded-md border border-border/60 p-3">
                              <div>
                                <div className="text-sm font-medium">
                                  {t("settings.nanobot.email.smtpUseSsl.title")}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {t(
                                    "settings.nanobot.email.smtpUseSsl.subtitle",
                                  )}
                                </div>
                              </div>
                              <Switch
                                checked={appSettings.nanobotEmailSmtpUseSsl}
                                onCheckedChange={(checked: any) => {
                                  void onUpdateAppSettings({
                                    ...appSettings,
                                    nanobotEmailSmtpUseSsl: checked,
                                  });
                                }}
                              />
                            </div>
                          </div>
                          <div className="flex items-start justify-between gap-3 rounded-md border border-border/60 p-3">
                            <div>
                              <div className="text-sm font-medium">
                                {t("settings.nanobot.email.autoReply.title")}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {t("settings.nanobot.email.autoReply.subtitle")}
                              </div>
                            </div>
                            <Switch
                              checked={appSettings.nanobotEmailAutoReplyEnabled}
                              onCheckedChange={(checked: any) => {
                                void onUpdateAppSettings({
                                  ...appSettings,
                                  nanobotEmailAutoReplyEnabled: checked,
                                });
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="rounded-md border border-border/60 p-3">
                        <div className="mb-3 text-sm font-medium">
                          {t("settings.nanobot.qq.sectionTitle")}
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3 rounded-md border border-border/60 p-3">
                            <div>
                              <div className="text-sm font-medium">
                                {t("settings.nanobot.qq.enable.title")}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {t("settings.nanobot.qq.enable.subtitle")}
                              </div>
                            </div>
                            <Switch
                              checked={appSettings.nanobotQqEnabled}
                              onCheckedChange={(checked: any) => {
                                void onUpdateAppSettings({
                                  ...appSettings,
                                  nanobotQqEnabled: checked,
                                  nanobotQqAppId: nextNanobotQqAppId,
                                  nanobotQqSecret: nextNanobotQqSecret,
                                  nanobotQqAllowFrom: nextNanobotQqAllowFrom,
                                });
                              }}
                            />
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="nanobot-qq-app-id">
                                {t("settings.nanobot.qq.appId.label")}
                              </Label>
                              <Input
                                id="nanobot-qq-app-id"
                                value={nanobotQqAppIdDraft}
                                placeholder={t(
                                  "settings.nanobot.qq.appId.placeholder",
                                )}
                                onChange={(event: any) =>
                                  setNanobotQqAppIdDraft(event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="nanobot-qq-secret">
                                {t("settings.nanobot.qq.secret.label")}
                              </Label>
                              <Input
                                id="nanobot-qq-secret"
                                type="password"
                                value={nanobotQqSecretDraft}
                                placeholder={t(
                                  "settings.nanobot.qq.secret.placeholder",
                                )}
                                onChange={(event: any) =>
                                  setNanobotQqSecretDraft(event.target.value)
                                }
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="nanobot-qq-allow-from">
                              {t("settings.nanobot.qq.allowFrom.label")}
                            </Label>
                            <Input
                              id="nanobot-qq-allow-from"
                              value={nanobotQqAllowFromDraft}
                              placeholder={t(
                                "settings.nanobot.qq.allowFrom.placeholder",
                              )}
                              onChange={(event: any) =>
                                setNanobotQqAllowFromDraft(event.target.value)
                              }
                            />
                            <div className="text-xs text-muted-foreground">
                              {t("settings.nanobot.qq.allowFrom.help")}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {nanobotDirty ? (
                          <Button
                            type="button"
                            onClick={handleSaveNanobotSettings}
                            disabled={isSavingSettings}
                          >
                            {isSavingSettings
                              ? t("settings.action.saving")
                              : t("settings.action.save")}
                          </Button>
                        ) : null}
                      </div>
                      {nanobotCleanupState.status === "done" &&
                      nanobotCleanupState.message ? (
                        <div
                          className={cn(
                            "rounded-md border p-3 text-xs",
                            nanobotCleanupState.ok
                              ? "border-emerald-500/40 bg-emerald-50/40 text-emerald-900 dark:text-emerald-200"
                              : "border-destructive/40 bg-destructive/10",
                          )}
                        >
                          {nanobotCleanupState.message}
                        </div>
                      ) : null}
                      <div className="text-xs text-muted-foreground">
                        {nanobotConfigPath
                          ? t("settings.nanobot.configPath", {
                            value: nanobotConfigPath,
                          })
                          : nanobotConfigPathError
                            ? t("settings.nanobot.configPathError", {
                              value: nanobotConfigPathError,
                            })
                            : t("settings.status.loading")}
                      </div>
                    </div>
                  </SettingsSection>
                </div>
              </TabsContent>
  );
}

