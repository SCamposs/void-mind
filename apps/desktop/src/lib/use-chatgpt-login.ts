import { useCallback } from "react";
import { beginChatGPTLogin, cancelChatGPTLogin } from "./connections-bridge";
import { useMindStore } from "../stores/mind-store";
export const connectionError = (error: unknown) => error instanceof Error ? error.message : typeof error === "string" ? error : "Could not update the connection. Try again.";
export function useChatGPTLogin() {
  const login = useMindStore((s) => s.chatgptLogin);
  const setLogin = useMindStore((s) => s.setChatGPTLogin);
  const beginLogin = useCallback(async (accountId?: string) => {
    setLogin({ state: "pending", message: "Opening your browser for secure ChatGPT sign-in…" });
    try {
      const loginId = await beginChatGPTLogin(accountId);
      // Completion can arrive before IPC returns on a returning account.
      if (useMindStore.getState().chatgptLogin.state === "pending") setLogin({ state: "pending", loginId, message: "Complete sign-in and authorization in your browser." });
    } catch (error) { setLogin({ state: "error", message: connectionError(error) }); }
  }, [setLogin]);
  const cancelLogin = useCallback(async () => {
    if (!login.loginId) return;
    try { await cancelChatGPTLogin(login.loginId); } catch (error) { setLogin({ state: "error", message: connectionError(error) }); }
  }, [login.loginId, setLogin]);
  return { login, beginLogin, cancelLogin };
}
