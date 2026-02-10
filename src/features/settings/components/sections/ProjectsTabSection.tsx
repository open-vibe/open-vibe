import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import { SettingsSection } from "../SettingsSection";

export function ProjectsTabSection(props: any) {
  const {t, newGroupName, setNewGroupName, canCreateGroup, handleCreateGroup, groupError, workspaceGroups, groupDrafts, setGroupDrafts, handleRenameGroup, handleChooseGroupCopiesFolder, handleClearGroupCopiesFolder, onMoveWorkspaceGroup, handleDeleteGroup, groupedWorkspaces, onAssignWorkspaceGroup, ungroupedLabel, onMoveWorkspace, onDeleteWorkspace, projects, appSettings, onUpdateAppSettings, UNGROUPED_SELECT_VALUE, cn} = props;

  return (
<TabsContent value="projects" className="mt-0">
                <div className="space-y-4">
                  <SettingsSection
                    title={t("settings.projects.title")}
                    description={t("settings.projects.subtitle")}
                  >
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          {t("settings.projects.groups.title")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {t("settings.projects.groups.subtitle")}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          className="min-w-[220px] flex-1"
                          value={newGroupName}
                          placeholder={t(
                            "settings.projects.groupName.placeholder",
                          )}
                          aria-label={t(
                            "settings.projects.groupName.placeholder",
                          )}
                          onChange={(event: any) =>
                            setNewGroupName(event.target.value)
                          }
                          onKeyDown={(event: any) => {
                            if (event.key === "Enter" && canCreateGroup) {
                              event.preventDefault();
                              void handleCreateGroup();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={() => {
                            void handleCreateGroup();
                          }}
                          disabled={!canCreateGroup}
                        >
                          {t("settings.projects.group.add")}
                        </Button>
                      </div>
                      {groupError && (
                        <div className="text-sm text-destructive">
                          {groupError}
                        </div>
                      )}
                      {workspaceGroups.length > 0 ? (
                        <div className="space-y-3">
                          {workspaceGroups.map((group: any, index: any) => (
                            <div
                              key={group.id}
                              className="rounded-md border border-border/60 p-3"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="flex-1 min-w-[220px] space-y-3">
                                  <Input
                                    value={groupDrafts[group.id] ?? group.name}
                                    aria-label={t(
                                      "settings.projects.groupName.placeholder",
                                    )}
                                    onChange={(event: any) =>
                                      setGroupDrafts((prev: any) => ({
                                        ...prev,
                                        [group.id]: event.target.value,
                                      }))
                                    }
                                    onBlur={() => {
                                      void handleRenameGroup(group);
                                    }}
                                    onKeyDown={(event: any) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        void handleRenameGroup(group);
                                      }
                                    }}
                                  />
                                  <div className="space-y-2">
                                    <div className="text-sm font-medium">
                                      {t(
                                        "settings.projects.group.copiesFolder",
                                      )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div
                                        className={cn(
                                          "flex-1 min-w-[200px] truncate rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs",
                                          !group.copiesFolder &&
                                          "text-muted-foreground",
                                        )}
                                        title={group.copiesFolder ?? ""}
                                      >
                                        {group.copiesFolder ??
                                          t("settings.projects.group.notSet")}
                                      </div>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          void handleChooseGroupCopiesFolder(
                                            group,
                                          );
                                        }}
                                      >
                                        {t("settings.projects.group.choose")}
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          void handleClearGroupCopiesFolder(
                                            group,
                                          );
                                        }}
                                        disabled={!group.copiesFolder}
                                      >
                                        {t("settings.projects.group.clear")}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                      void onMoveWorkspaceGroup(group.id, "up");
                                    }}
                                    disabled={index === 0}
                                    aria-label={t(
                                      "settings.projects.group.moveUp",
                                    )}
                                  >
                                    <ChevronUp
                                      className="h-4 w-4"
                                      aria-hidden
                                    />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                      void onMoveWorkspaceGroup(
                                        group.id,
                                        "down",
                                      );
                                    }}
                                    disabled={
                                      index === workspaceGroups.length - 1
                                    }
                                    aria-label={t(
                                      "settings.projects.group.moveDown",
                                    )}
                                  >
                                    <ChevronDown
                                      className="h-4 w-4"
                                      aria-hidden
                                    />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                      void handleDeleteGroup(group);
                                    }}
                                    aria-label={t(
                                      "settings.projects.group.delete",
                                    )}
                                  >
                                    <Trash2 className="h-4 w-4" aria-hidden />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          {t("settings.projects.group.empty")}
                        </div>
                      )}
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          {t("settings.projects.projects.title")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {t("settings.projects.projects.subtitle")}
                        </div>
                      </div>
                      <div className="space-y-3">
                        {groupedWorkspaces.map((group: any) => (
                          <div
                            key={group.id ?? "ungrouped"}
                            className="space-y-2"
                          >
                            <div className="text-xs font-semibold uppercase text-muted-foreground">
                              {group.name}
                            </div>
                            <div className="space-y-2">
                              {group.workspaces.map((workspace: any, index: any) => {
                                const groupValue = workspaceGroups.some(
                                  (entry: any) =>
                                    entry.id === workspace.settings.groupId,
                                )
                                  ? (workspace.settings.groupId ??
                                    UNGROUPED_SELECT_VALUE)
                                  : UNGROUPED_SELECT_VALUE;
                                return (
                                  <div
                                    key={workspace.id}
                                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 p-3"
                                  >
                                    <div className="min-w-[220px]">
                                      <div className="text-sm font-medium">
                                        {workspace.name}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {workspace.path}
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Select
                                        value={groupValue}
                                        onValueChange={(value: any) => {
                                          const nextGroupId =
                                            value === UNGROUPED_SELECT_VALUE
                                              ? null
                                              : value;
                                          void onAssignWorkspaceGroup(
                                            workspace.id,
                                            nextGroupId,
                                          );
                                        }}
                                      >
                                        <SelectTrigger className="w-[180px]">
                                          <SelectValue
                                            placeholder={ungroupedLabel}
                                          />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem
                                            value={UNGROUPED_SELECT_VALUE}
                                          >
                                            {ungroupedLabel}
                                          </SelectItem>
                                          {workspaceGroups.map((entry: any) => (
                                            <SelectItem
                                              key={entry.id}
                                              value={entry.id}
                                            >
                                              {entry.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="text-muted-foreground hover:text-foreground"
                                        onClick={() =>
                                          onMoveWorkspace(workspace.id, "up")
                                        }
                                        disabled={index === 0}
                                        aria-label={t(
                                          "settings.projects.project.moveUp",
                                        )}
                                      >
                                        <ChevronUp
                                          className="h-4 w-4"
                                          aria-hidden
                                        />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="text-muted-foreground hover:text-foreground"
                                        onClick={() =>
                                          onMoveWorkspace(workspace.id, "down")
                                        }
                                        disabled={
                                          index === group.workspaces.length - 1
                                        }
                                        aria-label={t(
                                          "settings.projects.project.moveDown",
                                        )}
                                      >
                                        <ChevronDown
                                          className="h-4 w-4"
                                          aria-hidden
                                        />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="text-muted-foreground hover:text-foreground"
                                        onClick={() =>
                                          onDeleteWorkspace(workspace.id)
                                        }
                                        aria-label={t(
                                          "settings.projects.project.delete",
                                        )}
                                      >
                                        <Trash2
                                          className="h-4 w-4"
                                          aria-hidden
                                        />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        {projects.length === 0 && (
                          <div className="text-sm text-muted-foreground">
                            {t("settings.projects.project.empty")}
                          </div>
                        )}
                      </div>
                    </div>
                    <Separator />
                    <div className="flex items-start justify-between gap-4 rounded-md border border-border/60 p-3">
                      <div className="space-y-1">
                        <Label htmlFor="refresh-threads-on-focus">
                          {t("settings.projects.refreshOnFocus.title")}
                        </Label>
                        <div className="text-sm text-muted-foreground">
                          {t("settings.projects.refreshOnFocus.subtitle")}
                        </div>
                      </div>
                      <Switch
                        id="refresh-threads-on-focus"
                        checked={appSettings.refreshThreadsOnFocus}
                        onCheckedChange={(value: any) =>
                          void onUpdateAppSettings({
                            ...appSettings,
                            refreshThreadsOnFocus: value,
                          })
                        }
                      />
                    </div>
                  </SettingsSection>
                </div>
              </TabsContent>
  );
}

