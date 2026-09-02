import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { codexBridge } from "../../lib/codex-bridge";
import { useMindStore } from "../../stores/mind-store";
import { VoidMark } from "../../components/VoidMark";

export function OnboardingScreen() {
  const state = useMindStore();
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  const connect = async () => {
    setWorking(true);
    setMessage("");
    try {
      const login = await codexBridge.beginLogin("browser");
      if (login.authUrl) await codexBridge.openAuthUrl(login.authUrl);
      setMessage("Finish signing in in the browser, then return here.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
    }
  };

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
        <button className="primary-button" type="button" disabled={working} onClick={() => void connect()}>Connect ChatGPT <ArrowRight size={15} /></button>
        <button className="secondary-button" type="button" onClick={() => state.updatePreferences({ onboardingComplete: true })}>Set up later</button>
      </div>
      {message && <p className="onboarding-status" role="status">{message}</p>}
      {state.codexAccount?.state === "connected" && (
        <button className="text-button" type="button" onClick={() => state.updatePreferences({ onboardingComplete: true })}>Continue to VOID Mind <ArrowRight size={14} /></button>
      )}
    </div>
  );
}
