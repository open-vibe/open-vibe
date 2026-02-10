import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { GENERIC_APP_ICON, getKnownOpenAppIcon } from "../../../app/utils/openAppIcons";
import { SettingsSection } from "../SettingsSection";

export function OpenAppsTabSection(props: any) {
  const {t, openAppDrafts, openAppIconById, handleOpenAppDraftChange, handleCommitOpenApps, handleOpenAppKindChange, fileManagerLabel, openAppSelectedId, handleSelectOpenAppDefault, handleMoveOpenApp, handleDeleteOpenApp, handleAddOpenApp} = props;

  return (
<TabsContent value="open-apps" className="mt-0">
                <div className="space-y-3">
                  <SettingsSection
                    title={t("settings.openApps.title")}
                    description={t("settings.openApps.subtitle")}
                  >
                    <div className="space-y-2">
                      {openAppDrafts.map((target: any, index: any) => {
                        const iconSrc =
                          getKnownOpenAppIcon(target.id) ??
                          openAppIconById[target.id] ??
                          GENERIC_APP_ICON;
                        return (
                          <div
                            key={target.id}
                            className="rounded-md border border-border/60 p-2 bg-card/50"
                          >
                            <div className="flex gap-3">
                              {/* 左侧图标：固定宽度，与第一行对齐 */}
                              <div
                                className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/50 bg-muted/30"
                                aria-hidden
                              >
                                <img
                                  src={iconSrc}
                                  alt=""
                                  width={14}
                                  height={14}
                                  className="opacity-80"
                                />
                              </div>

                              <div className="flex-1 min-w-0 space-y-1.5">
                                {/* 表单区域：左右布局 */}
                                <div className="grid gap-1.5 md:grid-cols-2">
                                  {/* 标签行 */}
                                  <div className="flex items-center gap-2">
                                    <Label
                                      htmlFor={`open-app-label-${target.id}`}
                                      className="w-12 shrink-0 text-right text-xs text-muted-foreground"
                                    >
                                      {t("settings.openApps.label")}
                                    </Label>
                                    <Input
                                      id={`open-app-label-${target.id}`}
                                      className="h-7 px-2 text-sm" // 高度进一步压缩至 h-7
                                      value={target.label}
                                      onChange={(event: any) =>
                                        handleOpenAppDraftChange(index, {
                                          label: event.target.value,
                                        })
                                      }
                                      onBlur={() =>
                                        void handleCommitOpenApps(openAppDrafts)
                                      }
                                    />
                                  </div>

                                  {/* 类型行 */}
                                  <div className="flex items-center gap-2">
                                    <Label
                                      htmlFor={`open-app-kind-${target.id}`}
                                      className="w-12 shrink-0 text-right text-xs text-muted-foreground"
                                    >
                                      {t("settings.openApps.type")}
                                    </Label>
                                    <Select
                                      value={target.kind}
                                      onValueChange={(value: any) =>
                                        handleOpenAppKindChange(
                                          index,
                                          value as any,
                                        )
                                      }
                                    >
                                      <SelectTrigger
                                        id={`open-app-kind-${target.id}`}
                                        className="h-7 px-2 text-sm"
                                      >
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="app">
                                          {t("settings.openApps.type.app")}
                                        </SelectItem>
                                        <SelectItem value="command">
                                          {t("settings.openApps.type.command")}
                                        </SelectItem>
                                        <SelectItem value="finder">
                                          {fileManagerLabel}
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* 动态显示的输入框 - 占据整行 */}
                                  {(target.kind === "app" ||
                                    target.kind === "command") && (
                                      <div className="flex items-center gap-2 md:col-span-2">
                                        <Label
                                          htmlFor={
                                            target.kind === "app"
                                              ? `open-app-appname-${target.id}`
                                              : `open-app-command-${target.id}`
                                          }
                                          className="w-12 shrink-0 text-right text-xs text-muted-foreground"
                                        >
                                          {target.kind === "app"
                                            ? t("settings.openApps.appName")
                                            : t("settings.openApps.command")}
                                        </Label>
                                        <Input
                                          id={
                                            target.kind === "app"
                                              ? `open-app-appname-${target.id}`
                                              : `open-app-command-${target.id}`
                                          }
                                          className="h-7 px-2 text-sm flex-1"
                                          value={
                                            (target.kind === "app"
                                              ? target.appName
                                              : target.command) ?? ""
                                          }
                                          onChange={(event: any) =>
                                            handleOpenAppDraftChange(
                                              index,
                                              target.kind === "app"
                                                ? { appName: event.target.value }
                                                : { command: event.target.value },
                                            )
                                          }
                                          onBlur={() =>
                                            void handleCommitOpenApps(
                                              openAppDrafts,
                                            )
                                          }
                                        />
                                      </div>
                                    )}

                                  {target.kind !== "finder" && (
                                    <div className="flex items-center gap-2 md:col-span-2">
                                      <Label
                                        htmlFor={`open-app-args-${target.id}`}
                                        className="w-12 shrink-0 text-right text-xs text-muted-foreground"
                                      >
                                        {t("settings.openApps.args")}
                                      </Label>
                                      <Input
                                        id={`open-app-args-${target.id}`}
                                        className="h-7 px-2 text-sm flex-1"
                                        value={target.argsText}
                                        onChange={(event: any) =>
                                          handleOpenAppDraftChange(index, {
                                            argsText: event.target.value,
                                          })
                                        }
                                        onBlur={() =>
                                          void handleCommitOpenApps(
                                            openAppDrafts,
                                          )
                                        }
                                      />
                                    </div>
                                  )}
                                </div>

                                {/* 底部紧凑操作栏 */}
                                <div className="flex items-center justify-between pt-1">
                                  <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer ml-14">
                                    <input
                                      type="radio"
                                      className="h-3 w-3"
                                      name="open-app-default"
                                      checked={target.id === openAppSelectedId}
                                      onChange={() =>
                                        handleSelectOpenAppDefault(target.id)
                                      }
                                    />
                                    {t("settings.openApps.default")}
                                  </label>
                                  <div className="flex items-center gap-0.5">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() =>
                                        handleMoveOpenApp(index, "up")
                                      }
                                      disabled={index === 0}
                                    >
                                      <ChevronUp className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() =>
                                        handleMoveOpenApp(index, "down")
                                      }
                                      disabled={
                                        index === openAppDrafts.length - 1
                                      }
                                    >
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 hover:text-destructive"
                                      onClick={() => handleDeleteOpenApp(index)}
                                      disabled={openAppDrafts.length <= 1}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddOpenApp}
                      >
                        {t("settings.action.addApp")}
                      </Button>
                      <div className="text-xs text-muted-foreground">
                        {t("settings.openApps.help")}
                      </div>
                    </div>
                  </SettingsSection>
                </div>
              </TabsContent>
  );
}

