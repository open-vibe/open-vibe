// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import type { AppSettings, WorkspaceInfo } from "../../../types";
import { I18nProvider } from "../../../i18n";
import { SettingsView } from "./SettingsView";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: vi.fn(),
  open: vi.fn(),
}));

const baseSettings: AppSettings = {
  codexBin: null,
  codexArgs: null,
  backendMode: "local",
  remoteBackendHost: "127.0.0.1:4732",
  remoteBackendToken: null,
  happyEnabled: false,
  happyServerUrl: "https://api.cluster-fluster.com",
  happyToken: null,
  happySecret: null,
  nanobotMode: "bridge",
  nanobotEnabled: false,
  nanobotSessionMemoryEnabled: true,
  nanobotAwayNotifyEnabled: false,
  nanobotAwayIdleSeconds: 120,
  nanobotAwayCooldownSeconds: 120,
  nanobotAwayBluetoothEnabled: false,
  nanobotAwayBluetoothKeyword: "",
  nanobotAwayBluetoothDeviceId: "",
  nanobotAwayBluetoothDeviceName: "",
  nanobotAgentModel: "",
  nanobotAgentReasoningEffort: null,
  nanobotDingTalkEnabled: false,
  nanobotDingTalkClientId: "",
  nanobotDingTalkClientSecret: "",
  nanobotDingTalkAllowFrom: "",
  nanobotEmailEnabled: false,
  nanobotEmailConsentGranted: false,
  nanobotEmailImapHost: "",
  nanobotEmailImapPort: 993,
  nanobotEmailImapUsername: "",
  nanobotEmailImapPassword: "",
  nanobotEmailImapMailbox: "INBOX",
  nanobotEmailImapUseSsl: true,
  nanobotEmailSmtpHost: "",
  nanobotEmailSmtpPort: 587,
  nanobotEmailSmtpUsername: "",
  nanobotEmailSmtpPassword: "",
  nanobotEmailSmtpUseTls: true,
  nanobotEmailSmtpUseSsl: false,
  nanobotEmailFromAddress: "",
  nanobotEmailAutoReplyEnabled: true,
  nanobotEmailPollIntervalSeconds: 30,
  nanobotEmailAllowFrom: "",
  nanobotQqEnabled: false,
  nanobotQqAppId: "",
  nanobotQqSecret: "",
  nanobotQqAllowFrom: "",
  defaultAccessMode: "current",
  composerModelShortcut: null,
  composerAccessShortcut: null,
  composerReasoningShortcut: null,
  composerCollaborationShortcut: null,
  interruptShortcut: null,
  newAgentShortcut: null,
  newWorktreeAgentShortcut: null,
  newCloneAgentShortcut: null,
  archiveThreadShortcut: null,
  toggleProjectsSidebarShortcut: null,
  toggleGitSidebarShortcut: null,
  toggleDebugPanelShortcut: null,
  toggleTerminalShortcut: null,
  cycleAgentNextShortcut: null,
  cycleAgentPrevShortcut: null,
  cycleWorkspaceNextShortcut: null,
  cycleWorkspacePrevShortcut: null,
  lastComposerModelId: null,
  lastComposerAccessMode: null,
  lastComposerReasoningEffort: null,
  uiScale: 1,
  compactSidebar: false,
  theme: "system",
  themeColor: "blue",
  language: "system",
  uiFontFamily:
    "\"SF Pro Text\", \"SF Pro Display\", -apple-system, \"Helvetica Neue\", sans-serif",
  codeFontFamily:
    "\"SF Mono\", \"SFMono-Regular\", Menlo, Monaco, monospace",
  codeFontSize: 11,
  notificationSoundsEnabled: true,
  notificationSoundVolume: 0.05,
  notificationSoundSuccessVolume: 0.05,
  notificationSoundErrorVolume: 0.05,
  notificationSoundSuccessId: "default-success",
  notificationSoundSuccessPath: null,
  notificationSoundErrorId: "default-error",
  notificationSoundErrorPath: null,
  refreshThreadsOnFocus: false,
  experimentalCollabEnabled: false,
  experimentalCollaborationModesEnabled: false,
  experimentalSteerEnabled: false,
  experimentalUnifiedExecEnabled: false,
  experimentalThreadResumeStreamingEnabled: false,
  experimentalYunyiEnabled: false,
  experimentalYunyiToken: "",
  dictationEnabled: false,
  dictationModelId: "base",
  dictationPreferredLanguage: null,
  dictationHoldKey: null,
  composerEditorPreset: "default",
  composerSendBehavior: "enter",
  composerSendConfirmationEnabled: false,
  composerFenceExpandOnSpace: false,
  composerFenceExpandOnEnter: false,
  composerFenceLanguageTags: false,
  composerFenceWrapSelection: false,
  composerFenceAutoWrapPasteMultiline: false,
  composerFenceAutoWrapPasteCodeLike: false,
  composerListContinuation: false,
  composerCodeBlockCopyUseModifier: false,
  workspaceGroups: [],
  openAppTargets: [
    {
      id: "vscode",
      label: "VS Code",
      kind: "app",
      appName: "Visual Studio Code",
      command: null,
      args: [],
    },
  ],
  selectedOpenAppId: "vscode",
};

const createDoctorResult = () => ({
  ok: true,
  codexBin: null,
  version: null,
  appServerOk: true,
  details: null,
  path: null,
  nodeOk: true,
  nodeVersion: null,
  nodeDetails: null,
});

const renderDisplaySection = async (
  options: {
    appSettings?: Partial<AppSettings>;
    reduceTransparency?: boolean;
    onUpdateAppSettings?: ComponentProps<typeof SettingsView>["onUpdateAppSettings"];
    onToggleTransparency?: ComponentProps<typeof SettingsView>["onToggleTransparency"];
  } = {},
) => {
  cleanup();
  const onUpdateAppSettings =
    options.onUpdateAppSettings ?? vi.fn().mockResolvedValue(undefined);
  const onToggleTransparency = options.onToggleTransparency ?? vi.fn();
  const props: ComponentProps<typeof SettingsView> = {
    reduceTransparency: options.reduceTransparency ?? false,
    onToggleTransparency,
    appSettings: { ...baseSettings, ...options.appSettings },
    models: [],
    openAppIconById: {},
    onUpdateAppSettings,
    workspaceGroups: [],
    groupedWorkspaces: [],
    ungroupedLabel: "Ungrouped",
    onClose: vi.fn(),
    onMoveWorkspace: vi.fn(),
    onDeleteWorkspace: vi.fn(),
    onCreateWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onRenameWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onMoveWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onDeleteWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onAssignWorkspaceGroup: vi.fn().mockResolvedValue(null),
    onRunDoctor: vi.fn().mockResolvedValue(createDoctorResult()),
    onGetNanobotConfigPath: vi.fn().mockResolvedValue("C:/Users/test/.nanobot/config.json"),
    onTestNanobotDingTalk: vi.fn().mockResolvedValue({
      ok: true,
      endpoint: "https://api.dingtalk.com/v1.0/oauth2/accessToken",
      message: "ok",
    }),
    onUpdateWorkspaceCodexBin: vi.fn().mockResolvedValue(undefined),
    onUpdateWorkspaceSettings: vi.fn().mockResolvedValue(undefined),
    scaleShortcutTitle: "Scale shortcut",
    scaleShortcutText: "Use Command +/-",
    onTestNotificationSound: vi.fn(),
    dictationModelStatus: null,
    onDownloadDictationModel: vi.fn(),
    onCancelDictationDownload: vi.fn(),
    onRemoveDictationModel: vi.fn(),
    initialSection: "display",
  };

  render(
    <I18nProvider language="en">
      <SettingsView {...props} />
    </I18nProvider>,
  );
  await screen.findByText("Theme");

  return { onUpdateAppSettings, onToggleTransparency };
};

const findNearestByRole = (
  labelText: string,
  role: Parameters<typeof screen.getByRole>[0],
  name?: string,
) => {
  const label = screen.getByText(labelText);
  let node = label.parentElement as HTMLElement | null;
  while (node) {
    const matches = name
      ? within(node).queryAllByRole(role, { name })
      : within(node).queryAllByRole(role);
    if (matches.length === 1) {
      return matches[0] as HTMLElement;
    }
    node = node.parentElement;
  }
  throw new Error(`Unable to find ${role} near label: ${labelText}`);
};

const clickSelectOption = async (labelText: string, optionText: string) => {
  const trigger = findNearestByRole(labelText, "combobox");
  fireEvent.click(trigger);
  const option = await screen.findByRole("option", { name: optionText });
  fireEvent.click(option);
};

describe("SettingsView Display", () => {
  it("updates the theme selection", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    await renderDisplaySection({ onUpdateAppSettings });

    await clickSelectOption("Theme", "Dark");

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ theme: "dark" }),
      );
    });
  });

  it("toggles reduce transparency", async () => {
    const onToggleTransparency = vi.fn();
    await renderDisplaySection({ onToggleTransparency, reduceTransparency: false });

    const toggle = findNearestByRole("Reduce transparency", "switch");
    fireEvent.click(toggle);

    expect(onToggleTransparency).toHaveBeenCalledWith(true);
  });

  it("commits interface scale on blur and enter with clamping", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    await renderDisplaySection({ onUpdateAppSettings });

    const scaleInput = screen.getByLabelText("Interface scale");

    fireEvent.change(scaleInput, { target: { value: "500%" } });
    fireEvent.blur(scaleInput);

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ uiScale: 3 }),
      );
    });

    fireEvent.change(scaleInput, { target: { value: "3%" } });
    fireEvent.keyDown(scaleInput, { key: "Enter" });

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ uiScale: 0.1 }),
      );
    });
  });

  it("commits font family changes on blur and enter", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    await renderDisplaySection({ onUpdateAppSettings });

    const uiFontInput = screen.getByLabelText("UI font family");
    fireEvent.change(uiFontInput, { target: { value: "Avenir, sans-serif" } });
    fireEvent.blur(uiFontInput);

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ uiFontFamily: "Avenir, sans-serif" }),
      );
    });

    const codeFontInput = screen.getByLabelText("Code font family");
    fireEvent.change(codeFontInput, {
      target: { value: "JetBrains Mono, monospace" },
    });
    fireEvent.keyDown(codeFontInput, { key: "Enter" });

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ codeFontFamily: "JetBrains Mono, monospace" }),
      );
    });
  });

  it("resets font families to defaults", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    await renderDisplaySection({ onUpdateAppSettings });

    fireEvent.click(findNearestByRole("UI font family", "button", "Reset"));
    fireEvent.click(findNearestByRole("Code font family", "button", "Reset"));

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          uiFontFamily: expect.stringContaining("SF Pro Text"),
        }),
      );
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          codeFontFamily: expect.stringContaining("SF Mono"),
        }),
      );
    });
  });

  it("updates code font size from the slider", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    await renderDisplaySection({ onUpdateAppSettings });

    const slider = screen.getByLabelText("Code font size");
    fireEvent.change(slider, { target: { value: "14" } });

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ codeFontSize: 14 }),
      );
    });
  });

  it("toggles notification sounds", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    await renderDisplaySection({
      onUpdateAppSettings,
      appSettings: { notificationSoundsEnabled: false },
    });

    const toggle = findNearestByRole("Notification sounds", "switch");
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ notificationSoundsEnabled: true }),
      );
    });
  });
});

describe("SettingsView Codex overrides", () => {
  it("updates workspace Codex args override on blur", async () => {
    const onUpdateWorkspaceSettings = vi.fn().mockResolvedValue(undefined);
    const workspace: WorkspaceInfo = {
      id: "w1",
      name: "Workspace",
      path: "/tmp/workspace",
      connected: false,
      codex_bin: null,
      kind: "main",
      parentId: null,
      worktree: null,
      settings: { sidebarCollapsed: false, codexArgs: null },
    };

    render(
      <I18nProvider language="en">
        <SettingsView
          workspaceGroups={[]}
          groupedWorkspaces={[
            { id: null, name: "Ungrouped", workspaces: [workspace] },
          ]}
          ungroupedLabel="Ungrouped"
          onClose={vi.fn()}
          onMoveWorkspace={vi.fn()}
          onDeleteWorkspace={vi.fn()}
          onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          reduceTransparency={false}
          onToggleTransparency={vi.fn()}
          appSettings={baseSettings}
          models={[]}
          openAppIconById={{}}
          onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
          onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
          onGetNanobotConfigPath={vi.fn().mockResolvedValue("C:/Users/test/.nanobot/config.json")}
          onTestNanobotDingTalk={vi.fn().mockResolvedValue({
            ok: true,
            endpoint: null,
            message: "ok",
          })}
          onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
          onUpdateWorkspaceSettings={onUpdateWorkspaceSettings}
          scaleShortcutTitle="Scale shortcut"
          scaleShortcutText="Use Command +/-"
          onTestNotificationSound={vi.fn()}
          dictationModelStatus={null}
          onDownloadDictationModel={vi.fn()}
          onCancelDictationDownload={vi.fn()}
          onRemoveDictationModel={vi.fn()}
          initialSection="codex"
        />
      </I18nProvider>,
    );

    const input = screen.getByLabelText("Codex args override for Workspace");
    fireEvent.change(input, { target: { value: "--profile dev" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(onUpdateWorkspaceSettings).toHaveBeenCalledWith("w1", {
        codexArgs: "--profile dev",
      });
    });
  });
});

describe("SettingsView Shortcuts", () => {
  it("closes on Cmd+W", () => {
    const onClose = vi.fn();
    render(
      <I18nProvider language="en">
        <SettingsView
          workspaceGroups={[]}
          groupedWorkspaces={[]}
          ungroupedLabel="Ungrouped"
          onClose={onClose}
          onMoveWorkspace={vi.fn()}
          onDeleteWorkspace={vi.fn()}
          onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          reduceTransparency={false}
          onToggleTransparency={vi.fn()}
          appSettings={baseSettings}
          models={[]}
          openAppIconById={{}}
          onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
          onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
          onGetNanobotConfigPath={vi.fn().mockResolvedValue("C:/Users/test/.nanobot/config.json")}
          onTestNanobotDingTalk={vi.fn().mockResolvedValue({
            ok: true,
            endpoint: null,
            message: "ok",
          })}
          onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
          onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
          scaleShortcutTitle="Scale shortcut"
          scaleShortcutText="Use Command +/-"
          onTestNotificationSound={vi.fn()}
          dictationModelStatus={null}
          onDownloadDictationModel={vi.fn()}
          onCancelDictationDownload={vi.fn()}
          onRemoveDictationModel={vi.fn()}
        />
      </I18nProvider>,
    );

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "w", metaKey: true, bubbles: true }),
      );
    });

    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <I18nProvider language="en">
        <SettingsView
          workspaceGroups={[]}
          groupedWorkspaces={[]}
          ungroupedLabel="Ungrouped"
          onClose={onClose}
          onMoveWorkspace={vi.fn()}
          onDeleteWorkspace={vi.fn()}
          onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          reduceTransparency={false}
          onToggleTransparency={vi.fn()}
          appSettings={baseSettings}
          models={[]}
          openAppIconById={{}}
          onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
          onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
          onGetNanobotConfigPath={vi.fn().mockResolvedValue("C:/Users/test/.nanobot/config.json")}
          onTestNanobotDingTalk={vi.fn().mockResolvedValue({
            ok: true,
            endpoint: null,
            message: "ok",
          })}
          onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
          onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
          scaleShortcutTitle="Scale shortcut"
          scaleShortcutText="Use Command +/-"
          onTestNotificationSound={vi.fn()}
          dictationModelStatus={null}
          onDownloadDictationModel={vi.fn()}
          onCancelDictationDownload={vi.fn()}
          onRemoveDictationModel={vi.fn()}
        />
      </I18nProvider>,
    );

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    expect(onClose).toHaveBeenCalled();
  });
});

describe("SettingsView Experimental", () => {
  it("shows Yunyi token input when enabled", async () => {
    render(
      <I18nProvider language="en">
        <SettingsView
          workspaceGroups={[]}
          groupedWorkspaces={[]}
          ungroupedLabel="Ungrouped"
          onClose={vi.fn()}
          onMoveWorkspace={vi.fn()}
          onDeleteWorkspace={vi.fn()}
          onCreateWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onRenameWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onMoveWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onDeleteWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          onAssignWorkspaceGroup={vi.fn().mockResolvedValue(null)}
          reduceTransparency={false}
          onToggleTransparency={vi.fn()}
          appSettings={{
            ...baseSettings,
            experimentalYunyiEnabled: true,
            experimentalYunyiToken: "",
          }}
          models={[]}
          openAppIconById={{}}
          onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
          onRunDoctor={vi.fn().mockResolvedValue(createDoctorResult())}
          onGetNanobotConfigPath={vi.fn().mockResolvedValue("C:/Users/test/.nanobot/config.json")}
          onTestNanobotDingTalk={vi.fn().mockResolvedValue({
            ok: true,
            endpoint: null,
            message: "ok",
          })}
          onUpdateWorkspaceCodexBin={vi.fn().mockResolvedValue(undefined)}
          onUpdateWorkspaceSettings={vi.fn().mockResolvedValue(undefined)}
          scaleShortcutTitle="Scale shortcut"
          scaleShortcutText="Use Command +/-"
          onTestNotificationSound={vi.fn()}
          dictationModelStatus={null}
          onDownloadDictationModel={vi.fn()}
          onCancelDictationDownload={vi.fn()}
          onRemoveDictationModel={vi.fn()}
          initialSection="experimental"
        />
      </I18nProvider>,
    );

    expect(await screen.findByLabelText("Yunyi API token")).toBeTruthy();
  });
});
