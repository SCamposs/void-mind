import { Button, Input } from "./Controls";
import { useRef, useState } from "react";
import { connectionAvailable } from "@void-mind/providers";
import { disconnectConnection, refreshConnections, saveAPIKey, selectChatGPTAccount, openUsage } from "../lib/connections-bridge";
import { connectionError, useChatGPTLogin } from "../lib/use-chatgpt-login";
import { useMindStore } from "../stores/mind-store";
import { SelectControl } from "./SelectControl";

export function ConnectionsPanel() {
  const state = useMindStore();
  const { login, beginLogin, cancelLogin } = useChatGPTLogin();
  const input = useRef<HTMLInputElement>(null);
  const [keyOpen, setKeyOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const status = state.connections;
  const active = status?.accounts.find((a) => a.id === status.activeAccountId);
  const busy = working || login.state === "pending" || ["generating", "connecting"].includes(state.generationState);
  const act = async (work: () => Promise<string | null | void>, success: string) => {
    setWorking(true); setMessage(null);
    try { const warning = await work(); await refreshConnections(); setMessage({ error: false, text: warning || success }); }
    catch (error) { setMessage({ error: true, text: connectionError(error) }); }
    finally { setWorking(false); }
  };
  return <section className="settings-section account-section">
    <div className="section-title"><h2>Connections</h2><p>Use your ChatGPT plan, or connect your own OpenAI API key.</p></div>
    {status?.accounts.length ? <div className="field">
      <span>ChatGPT account</span>
      <SelectControl label="ChatGPT account" value={status.activeAccountId ?? ""}
        options={status.accounts.map((a, index) => ({ value: a.id, label: `${a.email ?? "ChatGPT account"} · ${index + 1}`, detail: a.connected ? a.planAuthorized ? "Plan authorized" : "Plan use not enabled" : "Sign-in required" }))}
        disabled={busy} onChange={(id) => void act(() => selectChatGPTAccount(id), "ChatGPT account selected.")} />
    </div> : null}
    <div className="button-row">
      <Button className="primary-button" type="button" disabled={busy} onClick={() => void beginLogin(active?.id)}>Continue with ChatGPT</Button>
      {connectionAvailable(status, "openai-chatgpt") && <Button className="secondary-button" type="button" disabled={busy} onClick={() => state.setDefaultPreference({ providerId: "openai-chatgpt" })}>Use ChatGPT</Button>}
      {active?.connected && <Button className="text-button" type="button" disabled={busy} onClick={() => void act(() => disconnectConnection("openai-chatgpt"), "ChatGPT disconnected from VOID Mind.")}>Disconnect</Button>}
      {status?.accounts.length ? <Button className="text-button" type="button" disabled={busy} onClick={() => void beginLogin()}>Add account</Button> : null}
    </div>
    {active?.connected && !active.planAuthorized && <p className="status-message" role="status">Signed in. ChatGPT plan use has not been authorized; continue with ChatGPT to review permissions.</p>}
    {login.message && <p className={`status-message is-${login.state}`} role={login.state === "error" ? "alert" : "status"}>{login.message}</p>}
    {login.loginId && <Button className="text-button" type="button" onClick={() => void cancelLogin()}>Cancel sign-in</Button>}
    <div className="connection-alternative">
      <Button className="text-button" type="button" aria-expanded={keyOpen} aria-controls="api-key-connection" disabled={busy} onClick={() => setKeyOpen(!keyOpen)}>{status?.apiConnected ? "Manage API key" : "Use API key"}</Button>
      {keyOpen && <form id="api-key-connection" className="field-stack" onSubmit={(event) => {
        event.preventDefault(); const key = input.current?.value ?? "";
        if (input.current) input.current.value = "";
        void act(async () => { await saveAPIKey(key); useMindStore.getState().setDefaultPreference({ providerId: "openai-api" }); }, "OpenAI API connected. Choose a model below.");
      }}>
        <label className="field"><span>OpenAI API key</span><Input ref={input} type="password" required autoComplete="off" spellCheck={false} disabled={busy} placeholder="Paste your API key" /><small>Stored in your system credential store. API usage follows your OpenAI API billing.</small></label>
        <div className="button-row"><Button className="secondary-button" type="submit" disabled={busy}>{working ? "Connecting…" : status?.apiConnected ? "Replace key" : "Connect API key"}</Button>
          {status?.apiConnected && <><Button className="text-button" type="button" disabled={busy} onClick={() => state.setDefaultPreference({ providerId: "openai-api" })}>Use OpenAI API</Button><Button className="text-button" type="button" disabled={busy} onClick={() => void act(() => disconnectConnection("openai-api"), "API key removed from this device.")}>Remove key</Button></>}
        </div>
      </form>}
    </div>
    {message && <p className={`status-message is-${message.error ? "error" : "success"}`} role={message.error ? "alert" : "status"}>{message.text}</p>}
    <p className="runtime-detail">Messages and selected context are sent to OpenAI when either connection is active.</p>
    <Button className="text-button" type="button" onClick={() => void act(openUsage, "Usage settings opened in your browser.")}>Manage ChatGPT usage</Button>
  </section>;
}
