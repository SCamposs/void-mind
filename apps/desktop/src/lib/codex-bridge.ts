import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  CodexAccountState,
  CodexBridge,
  CodexLoginStart,
  CodexProtocolModel,
  CodexRuntimeEvent,
  CodexRuntimeStatus
} from "@void-mind/providers";

const isTauri = () => "__TAURI_INTERNALS__" in globalThis;

function desktopOnly(): never {
  throw new Error("Codex account integration is available in the VOID Mind desktop app.");
}

export const codexBridge: CodexBridge = {
  status: () =>
    isTauri() ? invoke<CodexRuntimeStatus>("codex_status") : Promise.reject(desktopOnly()),
  start: () =>
    isTauri() ? invoke<CodexRuntimeStatus>("codex_start") : Promise.reject(desktopOnly()),
  stop: () =>
    isTauri() ? invoke<CodexRuntimeStatus>("codex_stop") : Promise.reject(desktopOnly()),
  account: () =>
    isTauri() ? invoke<CodexAccountState>("codex_account") : Promise.reject(desktopOnly()),
  beginLogin: (flow) =>
    isTauri()
      ? invoke<CodexLoginStart>("codex_login_start", { flow })
      : Promise.reject(desktopOnly()),
  cancelLogin: (loginId) =>
    isTauri()
      ? invoke<void>("codex_login_cancel", { loginId })
      : Promise.reject(desktopOnly()),
  logout: () =>
    isTauri() ? invoke<void>("codex_logout") : Promise.reject(desktopOnly()),
  openAuthUrl: (url) =>
    isTauri()
      ? invoke<void>("open_codex_auth_url", { url })
      : Promise.reject(desktopOnly()),
  models: () =>
    isTauri()
      ? invoke<CodexProtocolModel[]>("codex_models")
      : Promise.reject(desktopOnly()),
  startThread: (request) =>
    isTauri()
      ? invoke<{ remoteThreadId: string }>("codex_thread_start", { request })
      : Promise.reject(desktopOnly()),
  resumeThread: (request) =>
    isTauri()
      ? invoke<{ remoteThreadId: string }>("codex_thread_resume", { request })
      : Promise.reject(desktopOnly()),
  startTurn: (request) =>
    isTauri()
      ? invoke<{ turnId: string }>("codex_turn_start", { request })
      : Promise.reject(desktopOnly()),
  interrupt: (request) =>
    isTauri()
      ? invoke<void>("codex_turn_interrupt", { request })
      : Promise.reject(desktopOnly()),
  subscribe: async (listener) => {
    if (!isTauri()) desktopOnly();
    return listen<CodexRuntimeEvent>("void-mind://codex-event", ({ payload }) => {
      listener(payload);
    });
  }
};
