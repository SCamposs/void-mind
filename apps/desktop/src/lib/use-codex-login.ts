import { useCallback } from "react";
import { codexBridge } from "./codex-bridge";
import { useMindStore } from "../stores/mind-store";

export function useCodexLogin() {
  const login = useMindStore((state) => state.codexLogin);
  const setLogin = useMindStore((state) => state.setCodexLogin);

  const beginLogin = useCallback(async (flow: "browser" | "deviceCode") => {
    setLogin({ state: "pending", message: "Starting secure ChatGPT sign-in through Codex…" });
    try {
      const started = await codexBridge.beginLogin(flow);
      setLogin({
        state: "pending",
        loginId: started.loginId,
        userCode: started.userCode,
        message: started.userCode
          ? "Enter this one-time code in the opened browser."
          : "Finish signing in in the opened browser."
      });
      try {
        if (started.authUrl) await codexBridge.openAuthUrl(started.authUrl);
        if (started.verificationUrl) await codexBridge.openAuthUrl(started.verificationUrl);
      } catch (error) {
        setLogin({
          state: "error",
          loginId: started.loginId,
          userCode: started.userCode,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    } catch (error) {
      setLogin({
        state: "error",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }, [setLogin]);

  const cancelLogin = useCallback(async () => {
    if (!login.loginId) return;
    try {
      await codexBridge.cancelLogin(login.loginId);
      setLogin({ state: "idle", message: "Sign-in cancelled." });
    } catch (error) {
      setLogin({
        state: "error",
        loginId: login.loginId,
        userCode: login.userCode,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }, [login.loginId, login.userCode, setLogin]);

  return { login, beginLogin, cancelLogin };
}
