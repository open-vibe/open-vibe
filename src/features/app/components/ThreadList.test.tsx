// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ThreadSummary } from "../../../types";
import { SidebarProvider } from "../../../components/ui/sidebar";
import { ThreadList } from "./ThreadList";

const nestedThread: ThreadSummary = {
  id: "thread-2",
  name: "Nested Agent",
  updatedAt: 900,
};

const thread: ThreadSummary = {
  id: "thread-1",
  name: "Alpha",
  updatedAt: 1000,
};

const statusMap = {
  "thread-1": { isProcessing: false, hasUnread: true, isReviewing: false },
  "thread-2": { isProcessing: false, hasUnread: false, isReviewing: false },
};

const baseProps = {
  workspaceId: "ws-1",
  pinnedRows: [],
  unpinnedRows: [{ thread, depth: 0 }],
  totalThreadRoots: 1,
  isExpanded: false,
  nextCursor: null,
  isPaging: false,
  nested: false,
  activeWorkspaceId: "ws-1",
  activeThreadId: "thread-1",
  threadStatusById: statusMap,
  getThreadTime: () => "2m",
  isThreadPinned: () => false,
  onToggleExpanded: vi.fn(),
  onLoadOlderThreads: vi.fn(),
  onSelectThread: vi.fn(),
  onShowThreadMenu: vi.fn(),
};

describe("ThreadList", () => {
  it("renders active row and handles click/context menu", () => {
    const onSelectThread = vi.fn();
    const onShowThreadMenu = vi.fn();

    render(
      <SidebarProvider>
        <ThreadList
          {...baseProps}
          onSelectThread={onSelectThread}
          onShowThreadMenu={onShowThreadMenu}
        />
      </SidebarProvider>,
    );

    const row = screen.getByText("Alpha").closest('[data-thread-row="true"]');
    expect(row).toBeTruthy();
    if (!row) {
      throw new Error("Missing thread row");
    }
    expect(row.getAttribute("data-active")).toBe("true");
    expect(
      row.querySelector("[data-thread-status]")?.getAttribute("data-thread-status"),
    ).toBe("unread");

    fireEvent.click(row);
    expect(onSelectThread).toHaveBeenCalledWith("ws-1", "thread-1");

    fireEvent.contextMenu(row);
    expect(onShowThreadMenu).toHaveBeenCalledWith(
      expect.anything(),
      "ws-1",
      "thread-1",
      true,
    );
  });

  it("shows the more button and toggles expanded", () => {
    const onToggleExpanded = vi.fn();
    render(
      <SidebarProvider>
        <ThreadList
          {...baseProps}
          totalThreadRoots={4}
          onToggleExpanded={onToggleExpanded}
        />
      </SidebarProvider>,
    );

    const moreButton = screen.getByRole("button", { name: "More..." });
    fireEvent.click(moreButton);
    expect(onToggleExpanded).toHaveBeenCalledWith("ws-1");
  });

  it("loads older threads when a cursor is available", () => {
    const onLoadOlderThreads = vi.fn();
    render(
      <SidebarProvider>
        <ThreadList
          {...baseProps}
          nextCursor="cursor"
          onLoadOlderThreads={onLoadOlderThreads}
        />
      </SidebarProvider>,
    );

    const loadButton = screen.getByRole("button", { name: "Load older..." });
    fireEvent.click(loadButton);
    expect(onLoadOlderThreads).toHaveBeenCalledWith("ws-1");
  });

  it("renders nested rows with indentation and disables pinning", () => {
    const onShowThreadMenu = vi.fn();
    render(
      <SidebarProvider>
        <ThreadList
          {...baseProps}
          nested
          unpinnedRows={[
            { thread, depth: 0 },
            { thread: nestedThread, depth: 1 },
          ]}
          onShowThreadMenu={onShowThreadMenu}
        />
      </SidebarProvider>,
    );

    const nestedRow = screen
      .getByText("Nested Agent")
      .closest('[data-thread-row="true"]');
    expect(nestedRow).toBeTruthy();
    if (!nestedRow) {
      throw new Error("Missing nested thread row");
    }
    expect(nestedRow.getAttribute("style")).toContain("padding-left");

    fireEvent.contextMenu(nestedRow);
    expect(onShowThreadMenu).toHaveBeenCalledWith(
      expect.anything(),
      "ws-1",
      "thread-2",
      false,
    );
  });
});
