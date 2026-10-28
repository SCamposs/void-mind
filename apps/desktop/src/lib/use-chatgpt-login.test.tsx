import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMindStore } from "../stores/mind-store";
import { useChatGPTLogin } from "./use-chatgpt-login";
import { beginChatGPTLogin, cancelChatGPTLogin, chatGPTLoginProgress, refreshConnections } from "./connections-bridge";

vi.mock("./connections-bridge", () => ({ beginChatGPTLogin: vi.fn(), cancelChatGPTLogin: vi.fn(), chatGPTLoginProgress: vi.fn(), refreshConnections: vi.fn() }));

describe("direct ChatGPT login progress", () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.resetAllMocks();
    useMindStore.setState({ chatgptLogin: { state: "idle" } });
    vi.mocked(beginChatGPTLogin).mockResolvedValue("attempt-1");
    vi.mocked(chatGPTLoginProgress).mockResolvedValue(null);
  });
  afterEach(() => vi.useRealTimers());
  it("recovers a completion that was not delivered as a desktop event", async () => {
    const { result } = renderHook(() => useChatGPTLogin());
    await act(async () => result.current.beginLogin());
    vi.mocked(chatGPTLoginProgress).mockResolvedValue({ loginId: "attempt-1", state: "success", message: "Connected" });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(result.current.login).toMatchObject({ state: "success", message: "Connected" });
    expect(refreshConnections).toHaveBeenCalledOnce();
    expect(useMindStore.getState().defaultPreference.providerId).toBe("openai-chatgpt");
  });
  it("ignores a different attempt and preserves cancellation retry", async () => {
    const { result } = renderHook(() => useChatGPTLogin());
    await act(async () => result.current.beginLogin());
    vi.mocked(chatGPTLoginProgress).mockResolvedValue({ loginId: "other-attempt", state: "success", message: "Wrong account" });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(result.current.login.state).toBe("pending");
    expect(refreshConnections).not.toHaveBeenCalled();
    vi.mocked(cancelChatGPTLogin).mockRejectedValue(new Error("Try cancellation again"));
    await act(async () => result.current.cancelLogin());
    expect(result.current.login).toMatchObject({ state: "error", loginId: "attempt-1" });
  });
  it("does not overwrite completion received before the start command returns", async () => {
    vi.mocked(beginChatGPTLogin).mockImplementation(async () => {
      useMindStore.getState().setChatGPTLogin({ state: "success", message: "Connected already" });
      return "attempt-1";
    });
    const { result } = renderHook(() => useChatGPTLogin());
    await act(async () => result.current.beginLogin());
    expect(result.current.login).toEqual({ state: "success", message: "Connected already" });
  });
});
