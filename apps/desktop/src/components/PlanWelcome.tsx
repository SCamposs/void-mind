import { Dialog } from "@base-ui/react/dialog";
import { useState } from "react";
import { Button } from "./Controls";
import { useMindStore } from "../stores/mind-store";
import { refreshConnections, welcomeSeen, openUsage } from "../lib/connections-bridge";
import { connectionError } from "../lib/use-chatgpt-login";

export function PlanWelcome() {
  const pending = useMindStore((s) => s.connections?.welcomePending ?? false);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const close = async () => {
    setWorking(true); setError("");
    try { await welcomeSeen(); await refreshConnections(); }
    catch (error) { setError(connectionError(error)); }
    finally { setWorking(false); }
  };
  return <Dialog.Root open={pending} onOpenChange={(open) => { if (!open && !working) void close(); }}><Dialog.Portal>
    <Dialog.Backdrop className="connection-welcome-backdrop" />
    <Dialog.Popup className="connection-welcome">
      <Dialog.Title>You’re using your ChatGPT plan</Dialog.Title>
      <Dialog.Description>Eligible requests in VOID Mind use your ChatGPT plan. You can review and manage this usage in ChatGPT settings.</Dialog.Description>
      <Button className="text-button" onClick={() => void openUsage().catch((error) => setError(connectionError(error)))}>Manage usage</Button>
      <Button className="primary-button" disabled={working} onClick={() => void close()}>Got it</Button>
      {error && <p className="status-message is-error" role="alert">{error}</p>}
    </Dialog.Popup>
  </Dialog.Portal></Dialog.Root>;
}
