import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMindStore } from "../stores/mind-store";
import { codexBridge } from "./codex-bridge";
import { useCodexLogin } from "./use-codex-login";

describe("useCodexLogin", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useMindStore.setState({ codexLogin: { state: "idle" } });
  });

  it("keeps an already-started login cancelable when opening the browser fails", async () => {
    vi.spyOn(codexBridge, "beginLogin").mockResolvedValue({
      loginId: "login-1",
      flow: "deviceCode",
      verificationUrl: "https://example.com/device",
      userCode: "ABCD-EFGH"
    });
    vi.spyOn(codexBridge, "openAuthUrl").mockRejectedValue(new Error("Browser could not be opened."));
    const cancel = vi.spyOn(codexBridge, "cancelLogin").mockResolvedValue();
    const { result } = renderHook(() => useCodexLogin());

    await act(async () => result.current.beginLogin("deviceCode"));

    expect(result.current.login).toEqual({
      state: "error",
      loginId: "login-1",
      userCode: "ABCD-EFGH",
      message: "Browser could not be opened."
    });

    await act(async () => result.current.cancelLogin());

    expect(cancel).toHaveBeenCalledWith("login-1");
    expect(result.current.login).toEqual({ state: "idle", message: "Sign-in cancelled." });
  });

  it("preserves the login identifier when cancellation fails so it can be retried", async () => {
    vi.spyOn(codexBridge, "beginLogin").mockResolvedValue({
      loginId: "login-2",
      flow: "browser",
      authUrl: "https://example.com/auth"
    });
    vi.spyOn(codexBridge, "openAuthUrl").mockResolvedValue();
    vi.spyOn(codexBridge, "cancelLogin").mockRejectedValue(new Error("Cancellation failed."));
    const { result } = renderHook(() => useCodexLogin());

    await act(async () => result.current.beginLogin("browser"));
    await act(async () => result.current.cancelLogin());

    expect(result.current.login).toEqual({
      state: "error",
      loginId: "login-2",
      userCode: undefined,
      message: "Cancellation failed."
    });
  });
});
