// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../../i18n";
import { Home } from "./Home";

type HomeProps = ComponentProps<typeof Home>;

const baseProps: HomeProps = {
  onOpenProject: vi.fn(),
  onAddWorkspace: vi.fn(),
  latestAgentRuns: [],
  isLoadingLatestAgents: false,
  localUsageSnapshot: null,
  isLoadingLocalUsage: false,
  localUsageError: null,
  onRefreshLocalUsage: vi.fn(),
  usageMetric: "tokens" as const,
  onUsageMetricChange: vi.fn(),
  usageWorkspaceId: null,
  usageWorkspaceOptions: [],
  onUsageWorkspaceChange: vi.fn(),
  onSelectThread: vi.fn(),
};

describe("Home", () => {
  const renderHome = (props: Partial<HomeProps> = {}) =>
    render(
      <I18nProvider language="en">
        <Home {...baseProps} {...props} />
      </I18nProvider>,
    );

  it("renders latest agent runs and lets you open a thread", () => {
    const onSelectThread = vi.fn();
    renderHome({
      latestAgentRuns: [
        {
          message: "Ship the dashboard refresh",
          timestamp: Date.now(),
          projectName: "OpenVibe",
          groupName: "Frontend",
          workspaceId: "workspace-1",
          threadId: "thread-1",
          isProcessing: true,
        },
      ],
      onSelectThread,
    });

    expect(screen.getByText("Latest agents")).toBeTruthy();
    expect(screen.getAllByText("OpenVibe").length).toBeGreaterThan(0);
    expect(screen.getByText("Frontend")).toBeTruthy();
    const message = screen.getByText("Ship the dashboard refresh");
    const card = message.closest("button");
    expect(card).toBeTruthy();
    if (!card) {
      throw new Error("Expected latest agent card button");
    }
    fireEvent.click(card);
    expect(onSelectThread).toHaveBeenCalledWith("workspace-1", "thread-1");
    expect(screen.getByText("Running")).toBeTruthy();
  });

  it("shows the empty state when there are no latest runs", () => {
    renderHome();

    expect(screen.getByText("No agent activity yet")).toBeTruthy();
    expect(
      screen.getByText("Start a thread to see the latest responses here."),
    ).toBeTruthy();
  });

  it("renders usage cards in time mode", () => {
    renderHome({
      usageMetric: "time",
      localUsageSnapshot: {
        updatedAt: Date.now(),
        days: [
          {
            day: "2026-01-20",
            inputTokens: 10,
            cachedInputTokens: 0,
            outputTokens: 5,
            totalTokens: 15,
            agentTimeMs: 120000,
            agentRuns: 2,
          },
        ],
        totals: {
          last7DaysTokens: 15,
          last30DaysTokens: 15,
          averageDailyTokens: 15,
          cacheHitRatePercent: 0,
          peakDay: "2026-01-20",
          peakDayTokens: 15,
        },
        topModels: [],
      },
    });

    expect(screen.getAllByText("agent time").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Runs").length).toBeGreaterThan(0);
    expect(screen.getByText("Peak day")).toBeTruthy();
  });
});
