import { ArrowRight, Check } from "lucide-react";
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
        <span><Check size={14} /> Choose the context included in each conversation</span>
      </div>
      <div className="onboarding-actions">
        {connected ? (
          <button className="primary-button" type="button" onClick={() => state.updatePreferences({ onboardingComplete: true })}>Continue to VOID Mind <ArrowRight size={15} /></button>
        ) : (
          <>
            <button className="primary-button" type="button" disabled={login.state === "pending"} onClick={() => void beginLogin("browser")}>Continue with ChatGPT <ArrowRight size={15} /></button>
          </>
        )}
      </div>
      <div className="onboarding-alternatives">
        <button className="secondary-button" type="button" disabled={Boolean(login.loginId) || login.state === "pending"} onClick={() => {
          state.setDefaultPreference({ providerId: "void-local" });
          state.updatePreferences({ onboardingComplete: true });
          state.setSection("models");
        }}>Use a local model</button>
        <button className="text-button" type="button" disabled={Boolean(login.loginId) || login.state === "pending"} onClick={() => {
          state.updatePreferences({ onboardingComplete: true });
          state.setSection("home");
        }}>Explore first</button>
      </div>
      <p className="onboarding-availability">ChatGPT availability and usage depend on your OpenAI account.</p>
      {login.userCode && <div className="device-code"><span>One-time code</span><strong>{login.userCode}</strong></div>}
      {login.message && <p className={`onboarding-status is-${login.state}`} role={login.state === "error" ? "alert" : "status"}>{login.message}</p>}
      {login.loginId && <button className="text-button" type="button" onClick={() => void cancelLogin()}>Cancel sign-in</button>}
    </div>
  );
}
