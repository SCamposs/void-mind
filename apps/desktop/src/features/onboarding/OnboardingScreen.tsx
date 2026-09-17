import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { useCodexLogin } from "../../lib/use-codex-login";
import { useMindStore } from "../../stores/mind-store";
import { VoidMark } from "../../components/VoidMark";

export function OnboardingScreen() {
  const state = useMindStore();
  const { login, beginLogin, cancelLogin } = useCodexLogin();
  const connected = state.codexAccount?.state === "connected";

  return (
    <div className="onboarding-screen">
      <div className="onboarding-mark"><VoidMark /></div>
      <span className="quiet-label">VOID MIND</span>
      <h1>Your space to think with intelligence.</h1>
      <p>Conversations stay organized on this device. When you use ChatGPT, prompts and selected context are sent through the official Codex runtime.</p>
      <div className="onboarding-points">
        <span><Check size={14} /> ChatGPT account — no API key</span>
        <span><Check size={14} /> Workspace-scoped instructions and sources</span>
        <span><ShieldCheck size={14} /> Read-only runtime with approvals disabled</span>
      </div>
      <div className="onboarding-actions">
        {connected ? (
          <button className="primary-button" type="button" onClick={() => state.updatePreferences({ onboardingComplete: true })}>Continue to VOID Mind <ArrowRight size={15} /></button>
        ) : (
          <>
            <button className="primary-button" type="button" disabled={login.state === "pending"} onClick={() => void beginLogin("browser")}>Connect ChatGPT <ArrowRight size={15} /></button>
            <button className="secondary-button" type="button" disabled={login.state === "pending"} onClick={() => state.updatePreferences({ onboardingComplete: true })}>Set up later</button>
          </>
        )}
      </div>
      {login.userCode && <div className="device-code"><span>One-time code</span><strong>{login.userCode}</strong></div>}
      {login.message && <p className={`onboarding-status is-${login.state}`} role={login.state === "error" ? "alert" : "status"}>{login.message}</p>}
      {login.loginId && <button className="text-button" type="button" onClick={() => void cancelLogin()}>Cancel sign-in</button>}
    </div>
  );
}
