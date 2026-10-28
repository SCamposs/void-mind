import { useCallback, useEffect } from "react";
import { beginChatGPTLogin, cancelChatGPTLogin, chatGPTLoginProgress, refreshConnections } from "./connections-bridge";
import { useMindStore } from "../stores/mind-store";
export const connectionError = (error: unknown) => error instanceof Error ? error.message : typeof error === "string" ? error : "Could not update the connection. Try again.";
export function useChatGPTLogin() {
  const login = useMindStore((s) => s.chatgptLogin);
  const setLogin = useMindStore((s) => s.setChatGPTLogin);
  useEffect(() => {
    if (login.state !== "pending" || !login.loginId) return;
    let active = true;
    let reading = false;
    const read = async () => {
      if (reading) return;
      reading = true;
      try {
        const progress = await chatGPTLoginProgress();
        const current = useMindStore.getState().chatgptLogin;
        if (!active || !progress || progress.loginId !== login.loginId || current.state !== "pending") return;
        setLogin({ state: progress.state, message: progress.message, loginId: progress.state === "pending" ? progress.loginId : undefined });
        if (progress.state === "success") {
          useMindStore.getState().setDefaultPreference({ providerId: "openai-chatgpt" });
          await refreshConnections();
        }
      } catch (error) {
        if (active) setLogin({ state: "error", loginId: login.loginId, message: connectionError(error) });
      } finally { reading = false; }
    };
    const timer = window.setInterval(() => void read(), 1500);
    void read();
    return () => { active = false; window.clearInterval(timer); };
  }, [login.loginId, login.state, setLogin]);
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
    try { await cancelChatGPTLogin(login.loginId); } catch (error) { setLogin({ state: "error", loginId: login.loginId, message: connectionError(error) }); }
  }, [login.loginId, setLogin]);
  return { login, beginLogin, cancelLogin };
}
