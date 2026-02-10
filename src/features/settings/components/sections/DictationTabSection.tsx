import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import { formatDownloadSize } from "../../../../utils/formatting";
import { SettingsSection } from "../SettingsSection";

export function DictationTabSection(props: any) {
  const {t, platform, appSettings, onUpdateAppSettings, dictationModelStatus, onCancelDictationDownload, onDownloadDictationModel, dictationModels, selectedDictationModel, dictationProgress, dictationReady, onRemoveDictationModel, DICTATION_AUTO_VALUE, DICTATION_HOLD_OFF_VALUE} = props;

  return (
<TabsContent value="dictation" className="mt-0">
                <div className="space-y-4">
                  <SettingsSection
                    title={t("settings.dictation.title")}
                    description={t("settings.dictation.subtitle")}
                  >
                    {platform === "windows" && (
                      <div className="border-l-2 border-border/60 pl-3 text-sm text-muted-foreground">
                        {t("settings.dictation.windowsNote")}
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                      <div className="space-y-1">
                        <Label htmlFor="dictation-enabled">
                          {t("settings.dictation.enable.title")}
                        </Label>
                        <div className="text-sm text-muted-foreground">
                          {t("settings.dictation.enable.subtitle")}
                        </div>
                      </div>
                      <Switch
                        id="dictation-enabled"
                        checked={appSettings.dictationEnabled}
                        onCheckedChange={(value: any) => {
                          const nextEnabled = value;
                          void onUpdateAppSettings({
                            ...appSettings,
                            dictationEnabled: nextEnabled,
                          });
                          if (
                            !nextEnabled &&
                            dictationModelStatus?.state === "downloading" &&
                            onCancelDictationDownload
                          ) {
                            onCancelDictationDownload();
                          }
                          if (
                            nextEnabled &&
                            dictationModelStatus?.state === "missing" &&
                            onDownloadDictationModel
                          ) {
                            onDownloadDictationModel();
                          }
                        }}
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="dictation-model">
                          {t("settings.dictation.model.label")}
                        </Label>
                        <Select
                          value={appSettings.dictationModelId}
                          onValueChange={(value: any) =>
                            void onUpdateAppSettings({
                              ...appSettings,
                              dictationModelId: value,
                            })
                          }
                        >
                          <SelectTrigger id="dictation-model">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {dictationModels.map((model: any) => (
                              <SelectItem key={model.id} value={model.id}>
                                {model.label} ({model.size})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="text-sm text-muted-foreground">
                          {t("settings.dictation.modelHelp", {
                            note: selectedDictationModel.note,
                            size: selectedDictationModel.size,
                          })}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dictation-language">
                          {t("settings.dictation.language.label")}
                        </Label>
                        <Select
                          value={
                            appSettings.dictationPreferredLanguage ??
                            DICTATION_AUTO_VALUE
                          }
                          onValueChange={(value: any) =>
                            void onUpdateAppSettings({
                              ...appSettings,
                              dictationPreferredLanguage:
                                value === DICTATION_AUTO_VALUE ? null : value,
                            })
                          }
                        >
                          <SelectTrigger id="dictation-language">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={DICTATION_AUTO_VALUE}>
                              {t("settings.dictation.language.auto")}
                            </SelectItem>
                            <SelectItem value="en">
                              {t("settings.dictation.language.en")}
                            </SelectItem>
                            <SelectItem value="es">
                              {t("settings.dictation.language.es")}
                            </SelectItem>
                            <SelectItem value="fr">
                              {t("settings.dictation.language.fr")}
                            </SelectItem>
                            <SelectItem value="de">
                              {t("settings.dictation.language.de")}
                            </SelectItem>
                            <SelectItem value="it">
                              {t("settings.dictation.language.it")}
                            </SelectItem>
                            <SelectItem value="pt">
                              {t("settings.dictation.language.pt")}
                            </SelectItem>
                            <SelectItem value="nl">
                              {t("settings.dictation.language.nl")}
                            </SelectItem>
                            <SelectItem value="sv">
                              {t("settings.dictation.language.sv")}
                            </SelectItem>
                            <SelectItem value="no">
                              {t("settings.dictation.language.no")}
                            </SelectItem>
                            <SelectItem value="da">
                              {t("settings.dictation.language.da")}
                            </SelectItem>
                            <SelectItem value="fi">
                              {t("settings.dictation.language.fi")}
                            </SelectItem>
                            <SelectItem value="pl">
                              {t("settings.dictation.language.pl")}
                            </SelectItem>
                            <SelectItem value="tr">
                              {t("settings.dictation.language.tr")}
                            </SelectItem>
                            <SelectItem value="ru">
                              {t("settings.dictation.language.ru")}
                            </SelectItem>
                            <SelectItem value="uk">
                              {t("settings.dictation.language.uk")}
                            </SelectItem>
                            <SelectItem value="ja">
                              {t("settings.dictation.language.ja")}
                            </SelectItem>
                            <SelectItem value="ko">
                              {t("settings.dictation.language.ko")}
                            </SelectItem>
                            <SelectItem value="zh">
                              {t("settings.dictation.language.zh")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="text-sm text-muted-foreground">
                          {t("settings.dictation.language.help")}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dictation-hold-key">
                          {t("settings.dictation.holdKey.label")}
                        </Label>
                        <Select
                          value={
                            appSettings.dictationHoldKey ??
                            DICTATION_HOLD_OFF_VALUE
                          }
                          onValueChange={(value: any) =>
                            void onUpdateAppSettings({
                              ...appSettings,
                              dictationHoldKey:
                                value === DICTATION_HOLD_OFF_VALUE
                                  ? null
                                  : value,
                            })
                          }
                        >
                          <SelectTrigger id="dictation-hold-key">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={DICTATION_HOLD_OFF_VALUE}>
                              {t("settings.dictation.holdKey.off")}
                            </SelectItem>
                            <SelectItem value="alt">
                              {t("settings.dictation.holdKey.alt")}
                            </SelectItem>
                            <SelectItem value="shift">
                              {t("settings.dictation.holdKey.shift")}
                            </SelectItem>
                            <SelectItem value="control">
                              {t("settings.dictation.holdKey.control")}
                            </SelectItem>
                            <SelectItem value="meta">
                              {t("settings.dictation.holdKey.meta")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="text-sm text-muted-foreground">
                          {t("settings.dictation.holdKey.help")}
                        </div>
                      </div>
                    </div>
                    {dictationModelStatus && (
                      <div className="space-y-2 rounded-md border border-border/60 p-3">
                        <div className="text-sm font-medium">
                          {t("settings.dictation.status.label", {
                            label: selectedDictationModel.label,
                          })}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {dictationModelStatus.state === "ready" &&
                            t("settings.dictation.status.ready")}
                          {dictationModelStatus.state === "missing" &&
                            t("settings.dictation.status.missing")}
                          {dictationModelStatus.state === "downloading" &&
                            t("settings.dictation.status.downloading")}
                          {dictationModelStatus.state === "error" &&
                            (dictationModelStatus.error ??
                              t("settings.dictation.status.error"))}
                        </div>
                        {dictationProgress && (
                          <div className="space-y-1">
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full bg-primary"
                                style={{
                                  width: dictationProgress.totalBytes
                                    ? `${Math.min(
                                      100,
                                      (dictationProgress.downloadedBytes /
                                        dictationProgress.totalBytes) *
                                      100,
                                    )}%`
                                    : "0%",
                                }}
                              />
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDownloadSize(
                                dictationProgress.downloadedBytes,
                              )}
                            </div>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          {dictationModelStatus.state === "missing" && (
                            <Button
                              type="button"
                              onClick={onDownloadDictationModel}
                              disabled={!onDownloadDictationModel}
                            >
                              {t("settings.action.downloadModel")}
                            </Button>
                          )}
                          {dictationModelStatus.state === "downloading" && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={onCancelDictationDownload}
                              disabled={!onCancelDictationDownload}
                            >
                              {t("settings.action.cancelDownload")}
                            </Button>
                          )}
                          {dictationReady && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={onRemoveDictationModel}
                              disabled={!onRemoveDictationModel}
                            >
                              {t("settings.action.removeModel")}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </SettingsSection>
                </div>
              </TabsContent>
  );
}

