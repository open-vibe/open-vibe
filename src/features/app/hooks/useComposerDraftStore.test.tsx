// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useComposerDraftStore } from "./useComposerDraftStore";

vi.mock("../../../services/tauri", () => ({
  pickImageFiles: vi.fn().mockResolvedValue([]),
}));

describe("useComposerDraftStore", () => {
  it("persists thread drafts and restores them after remount", () => {
    globalThis.localStorage.clear();
    vi.useFakeTimers();

    const first = renderHook(() =>
      useComposerDraftStore({
        activeWorkspaceId: "ws-1",
        activeThreadId: "thread-1",
      }),
    );

    act(() => {
      first.result.current.handleDraftChange("remember this");
      first.result.current.attachImages(["/tmp/a.png"]);
    });
    act(() => {
      vi.runAllTimers();
    });

    first.unmount();

    const second = renderHook(() =>
      useComposerDraftStore({
        activeWorkspaceId: "ws-1",
        activeThreadId: "thread-1",
      }),
    );

    expect(second.result.current.activeDraft).toBe("remember this");
    expect(second.result.current.activeImages).toEqual(["/tmp/a.png"]);

    second.unmount();
    vi.useRealTimers();
  });

  it("scopes drafts by workspace and thread id", () => {
    globalThis.localStorage.clear();

    const { result, rerender, unmount } = renderHook(
      ({ activeWorkspaceId, activeThreadId }) =>
        useComposerDraftStore({ activeWorkspaceId, activeThreadId }),
      {
        initialProps: {
          activeWorkspaceId: "ws-1",
          activeThreadId: "thread-1",
        },
      },
    );

    act(() => {
      result.current.handleDraftChange("workspace one");
      result.current.attachImages(["/tmp/one.png"]);
    });

    rerender({
      activeWorkspaceId: "ws-2",
      activeThreadId: "thread-1",
    });

    expect(result.current.activeDraft).toBe("");
    expect(result.current.activeImages).toEqual([]);

    act(() => {
      result.current.handleDraftChange("workspace two");
    });

    expect(result.current.getDraftForThread("ws-1", "thread-1")).toBe("workspace one");
    expect(result.current.getImagesForThread("ws-1", "thread-1")).toEqual([
      "/tmp/one.png",
    ]);
    expect(result.current.getDraftForThread("ws-2", "thread-1")).toBe("workspace two");

    unmount();
  });
});
