// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PaneErrorBoundary } from "./PaneErrorBoundary";

function ThrowOnRender({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("boom");
  }
  return <div>ok</div>;
}

describe("PaneErrorBoundary", () => {
  it("contains pane failures and recovers when the reset key changes", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { rerender, unmount } = render(
        <div>
          <PaneErrorBoundary label="Chat messages" resetKey="a">
            <ThrowOnRender shouldThrow />
          </PaneErrorBoundary>
          <div>Sibling pane</div>
        </div>,
      );

      expect(screen.getByText("Chat messages crashed.")).toBeTruthy();
      expect(screen.getByText("Sibling pane")).toBeTruthy();

      rerender(
        <div>
          <PaneErrorBoundary label="Chat messages" resetKey="b">
            <ThrowOnRender shouldThrow={false} />
          </PaneErrorBoundary>
          <div>Sibling pane</div>
        </div>,
      );

      expect(screen.getByText("ok")).toBeTruthy();
      unmount();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("retries the pane when requested", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      let shouldThrow = true;
      const { rerender, unmount } = render(
        <PaneErrorBoundary label="Composer" resetKey="same">
          <ThrowOnRender shouldThrow={shouldThrow} />
        </PaneErrorBoundary>,
      );

      shouldThrow = false;
      rerender(
        <PaneErrorBoundary label="Composer" resetKey="same">
          <ThrowOnRender shouldThrow={shouldThrow} />
        </PaneErrorBoundary>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Retry pane" }));
      expect(screen.getByText("ok")).toBeTruthy();
      unmount();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
