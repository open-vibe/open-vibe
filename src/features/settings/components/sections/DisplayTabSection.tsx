import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import { SettingsSection } from "../SettingsSection";

export function DisplayTabSection(props: any) {
  const {t, appSettings, onUpdateAppSettings, reduceTransparency, onToggleTransparency, scaleShortcutTitle, scaleShortcutText, scaleDraft, setScaleDraft, handleCommitScale, handleResetScale, uiFontDraft, setUiFontDraft, handleCommitUiFont, codeFontDraft, setCodeFontDraft, handleCommitCodeFont, codeFontSizeDraft, setCodeFontSizeDraft, handleCommitCodeFontSize, successSoundValue, handleSelectNotificationSound, notificationSoundSelectOptions, successVolumePercent, onTestNotificationSound, successSoundIsCustom, handlePickCustomSound, formatSoundPathLabel, errorSoundValue, errorVolumePercent, errorSoundIsCustom, CODE_FONT_SIZE_DEFAULT, CODE_FONT_SIZE_MAX, CODE_FONT_SIZE_MIN, DEFAULT_CODE_FONT_FAMILY, DEFAULT_UI_FONT_FAMILY} = props;

  return (
<TabsContent value="display" className="mt-0">
                <div className="space-y-4">
                  <SettingsSection
                    title={t("settings.display.title")}
                    description={t("settings.display.subtitle")}
                  >
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          {t("settings.display.section.title")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {t("settings.display.section.subtitle")}
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="theme-select">
                            {t("settings.display.theme.label")}
                          </Label>
                          <Select
                            value={appSettings.theme}
                            onValueChange={(value: any) =>
                              void onUpdateAppSettings({
                                ...appSettings,
                                theme: value as any,
                              })
                            }
                          >
                            <SelectTrigger id="theme-select">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="system">
                                {t("settings.display.theme.system")}
                              </SelectItem>
                              <SelectItem value="light">
                                {t("settings.display.theme.light")}
                              </SelectItem>
                              <SelectItem value="dark">
                                {t("settings.display.theme.dark")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="language-select">
                            {t("settings.language.label")}
                          </Label>
                          <Select
                            value={appSettings.language}
                            onValueChange={(value: any) =>
                              void onUpdateAppSettings({
                                ...appSettings,
                                language: value as any,
                              })
                            }
                          >
                            <SelectTrigger id="language-select">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="system">
                                {t("language.system")}
                              </SelectItem>
                              <SelectItem value="en">
                                {t("language.english")}
                              </SelectItem>
                              <SelectItem value="zh-CN">
                                {t("language.chinese")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.language.help")}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                        <div className="space-y-1">
                          <Label htmlFor="reduce-transparency">
                            {t("settings.display.reduceTransparency.title")}
                          </Label>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.display.reduceTransparency.subtitle")}
                          </div>
                        </div>
                        <Switch
                          id="reduce-transparency"
                          checked={reduceTransparency}
                          onCheckedChange={(value: any) =>
                            onToggleTransparency(value)
                          }
                        />
                      </div>
                      <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                        <div className="space-y-1">
                          <Label htmlFor="compact-sidebar">
                            {t("settings.display.compactSidebar.title")}
                          </Label>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.display.compactSidebar.subtitle")}
                          </div>
                        </div>
                        <Switch
                          id="compact-sidebar"
                          checked={appSettings.compactSidebar}
                          onCheckedChange={(value: any) =>
                            void onUpdateAppSettings({
                              ...appSettings,
                              compactSidebar: value,
                            })
                          }
                        />
                      </div>
                      <div className="rounded-md border border-border/60 p-3">
                        <div className="space-y-2">
                          <Label htmlFor="ui-scale">
                            {t("settings.display.interfaceScale.title")}
                          </Label>
                          <div
                            className="text-sm text-muted-foreground"
                            title={scaleShortcutTitle}
                          >
                            {scaleShortcutText}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              id="ui-scale"
                              type="text"
                              inputMode="decimal"
                              className="w-24"
                              value={scaleDraft}
                              aria-label={t(
                                "settings.display.interfaceScale.label",
                              )}
                              onChange={(event: any) =>
                                setScaleDraft(event.target.value)
                              }
                              onBlur={() => {
                                void handleCommitScale();
                              }}
                              onKeyDown={(event: any) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void handleCommitScale();
                                }
                              }}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                void handleResetScale();
                              }}
                            >
                              {t("settings.display.reset")}
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-md border border-border/60 p-3">
                        <div className="space-y-2">
                          <Label htmlFor="ui-font-family">
                            {t("settings.display.uiFont.label")}
                          </Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              id="ui-font-family"
                              type="text"
                              value={uiFontDraft}
                              onChange={(event: any) =>
                                setUiFontDraft(event.target.value)
                              }
                              onBlur={() => {
                                void handleCommitUiFont();
                              }}
                              onKeyDown={(event: any) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void handleCommitUiFont();
                                }
                              }}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setUiFontDraft(DEFAULT_UI_FONT_FAMILY);
                                void onUpdateAppSettings({
                                  ...appSettings,
                                  uiFontFamily: DEFAULT_UI_FONT_FAMILY,
                                });
                              }}
                            >
                              {t("settings.display.reset")}
                            </Button>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.display.uiFont.help")}
                          </div>
                        </div>
                      </div>
                      <div className="rounded-md border border-border/60 p-3">
                        <div className="space-y-2">
                          <Label htmlFor="code-font-family">
                            {t("settings.display.codeFont.label")}
                          </Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              id="code-font-family"
                              type="text"
                              value={codeFontDraft}
                              onChange={(event: any) =>
                                setCodeFontDraft(event.target.value)
                              }
                              onBlur={() => {
                                void handleCommitCodeFont();
                              }}
                              onKeyDown={(event: any) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void handleCommitCodeFont();
                                }
                              }}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setCodeFontDraft(DEFAULT_CODE_FONT_FAMILY);
                                void onUpdateAppSettings({
                                  ...appSettings,
                                  codeFontFamily: DEFAULT_CODE_FONT_FAMILY,
                                });
                              }}
                            >
                              {t("settings.display.reset")}
                            </Button>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.display.codeFont.help")}
                          </div>
                        </div>
                      </div>
                      <div className="rounded-md border border-border/60 p-3">
                        <div className="space-y-2">
                          <Label htmlFor="code-font-size">
                            {t("settings.display.codeFontSize.label")}
                          </Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              id="code-font-size"
                              type="range"
                              min={CODE_FONT_SIZE_MIN}
                              max={CODE_FONT_SIZE_MAX}
                              step={1}
                              className="h-2 w-40"
                              value={codeFontSizeDraft}
                              onChange={(event: any) => {
                                const nextValue = Number(event.target.value);
                                setCodeFontSizeDraft(nextValue);
                                void handleCommitCodeFontSize(nextValue);
                              }}
                            />
                            <div className="text-sm text-muted-foreground">
                              {codeFontSizeDraft}px
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setCodeFontSizeDraft(CODE_FONT_SIZE_DEFAULT);
                                void handleCommitCodeFontSize(
                                  CODE_FONT_SIZE_DEFAULT,
                                );
                              }}
                            >
                              {t("settings.display.reset")}
                            </Button>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.display.codeFontSize.help")}
                          </div>
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          {t("settings.display.sounds.title")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {t("settings.display.sounds.subtitle")}
                        </div>
                      </div>
                      <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                        <div className="space-y-1">
                          <Label htmlFor="notification-sounds">
                            {t("settings.display.notificationSounds.title")}
                          </Label>
                          <div className="text-sm text-muted-foreground">
                            {t("settings.display.notificationSounds.subtitle")}
                          </div>
                        </div>
                        <Switch
                          id="notification-sounds"
                          checked={appSettings.notificationSoundsEnabled}
                          onCheckedChange={(value: any) =>
                            void onUpdateAppSettings({
                              ...appSettings,
                              notificationSoundsEnabled: value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-4 rounded-md border border-border/60 p-3">
                        <div className="space-y-2">
                          <Label>{t("settings.display.notificationSounds.success.label")}</Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <Select
                              value={successSoundValue}
                              onValueChange={(value: any) =>
                                void handleSelectNotificationSound("success", value)
                              }
                            >
                              <SelectTrigger className="min-w-[220px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {notificationSoundSelectOptions.success.map((option: any) => (
                                  <SelectItem key={option.id} value={option.id}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex min-w-[180px] items-center gap-2">
                              <input
                                type="range"
                                min={0}
                                max={100}
                                step={1}
                                value={successVolumePercent}
                                onChange={(event: any) =>
                                  void onUpdateAppSettings({
                                    ...appSettings,
                                    notificationSoundSuccessVolume:
                                      Number(event.target.value) / 100,
                                    notificationSoundVolume:
                                      Number(event.target.value) / 100,
                                  })
                                }
                                className="h-2 w-full cursor-pointer accent-[var(--primary)]"
                              />
                              <span className="w-10 text-right text-xs text-muted-foreground">
                                {successVolumePercent}%
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => onTestNotificationSound("success")}
                            >
                              {t("settings.display.notificationSounds.testSuccess")}
                            </Button>
                            {successSoundIsCustom && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => void handlePickCustomSound("success")}
                              >
                                {t("settings.display.notificationSounds.chooseFile")}
                              </Button>
                            )}
                          </div>
                          {successSoundIsCustom && (
                            <div className="text-xs text-muted-foreground">
                              {formatSoundPathLabel(appSettings.notificationSoundSuccessPath)}
                            </div>
                          )}
                        </div>
                        <Separator />
                        <div className="space-y-2">
                          <Label>{t("settings.display.notificationSounds.error.label")}</Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <Select
                              value={errorSoundValue}
                              onValueChange={(value: any) =>
                                void handleSelectNotificationSound("error", value)
                              }
                            >
                              <SelectTrigger className="min-w-[220px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {notificationSoundSelectOptions.error.map((option: any) => (
                                  <SelectItem key={option.id} value={option.id}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex min-w-[180px] items-center gap-2">
                              <input
                                type="range"
                                min={0}
                                max={100}
                                step={1}
                                value={errorVolumePercent}
                                onChange={(event: any) =>
                                  void onUpdateAppSettings({
                                    ...appSettings,
                                    notificationSoundErrorVolume:
                                      Number(event.target.value) / 100,
                                    notificationSoundVolume:
                                      Number(event.target.value) / 100,
                                  })
                                }
                                className="h-2 w-full cursor-pointer accent-[var(--primary)]"
                              />
                              <span className="w-10 text-right text-xs text-muted-foreground">
                                {errorVolumePercent}%
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => onTestNotificationSound("error")}
                            >
                              {t("settings.display.notificationSounds.testError")}
                            </Button>
                            {errorSoundIsCustom && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => void handlePickCustomSound("error")}
                              >
                                {t("settings.display.notificationSounds.chooseFile")}
                              </Button>
                            )}
                          </div>
                          {errorSoundIsCustom && (
                            <div className="text-xs text-muted-foreground">
                              {formatSoundPathLabel(appSettings.notificationSoundErrorPath)}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t("settings.display.notificationSounds.volume.help")}
                        </div>
                      </div>
                    </div>
                  </SettingsSection>
                </div>
              </TabsContent>
  );
}

