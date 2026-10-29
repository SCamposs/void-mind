import { useRef } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Button, Disclosure, Progress, SwitchControl } from "../../components/Controls";
import { useUpdateStore } from "./updateStore";

const APP_NAME = "VOID Mind";

export function UpdateDot() {
  return <span className="update-dot" aria-hidden="true" />;
}

export function UpdatePanel() {
  const state = useUpdateStore();
  const busy = state.isChecking || ["downloading", "installing", "readyToRestart"].includes(state.status);
  const checkNow = async () => {
    await state.checkForUpdates();
    if (useUpdateStore.getState().candidate) state.setDialogOpen(true);
  };
  return <section className="update-settings" aria-labelledby="app-updates-title">
    <div className="update-heading"><h2 id="app-updates-title">App updates</h2>
      {state.candidate
        ? <Button className="secondary-button" onClick={() => state.setDialogOpen(true)}>View update</Button>
        : <Button className="secondary-button" onClick={() => void checkNow()} disabled={busy || state.status === "unavailable"}>{state.isChecking ? "Checking…" : "Check now"}</Button>}
    </div>
    <label className="update-preference"><span><strong>Check automatically</strong><small>Check when {APP_NAME} opens and every hour. Installation always needs your approval.</small></span>
      <SwitchControl checked={state.automaticChecks} onCheckedChange={state.setAutomaticChecks} aria-label="Check for updates automatically" />
    </label>
    <p className="update-status" role="status">{state.status === "unavailable" ? "Update checks are available in the installed app." : state.candidate ? `Version ${state.candidate.version} is available.` : state.isChecking ? "Checking for updates…" : state.error ? "Could not check for updates. Try again when you are online." : state.status === "upToDate" ? `${APP_NAME} is up to date.` : state.automaticChecks ? "Automatic checks are enabled." : "Manual checks only. Use Check now when you want to look for a new version."}</p>
    {state.lastCheckedAt && <small className="update-last-checked">Last checked {new Date(state.lastCheckedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>}
  </section>;
}

/** Mounted once at app level so download progress survives navigation. */
export function UpdateDialog({ enabled = true }: { enabled?: boolean }) {
  const state = useUpdateStore();
  const laterRef = useRef<HTMLButtonElement>(null);
  const busy = state.status === "downloading" || state.status === "installing";
  const percentage = state.contentLength ? Math.min(100, Math.round(state.downloadedBytes / state.contentLength * 100)) : null;
  const title = state.status === "downloading" ? "Downloading update" : state.status === "installing" ? "Installing update" : state.status === "readyToRestart" ? "Restart to finish" : "An update is available";
  return <Dialog.Root open={enabled && state.dialogOpen && !!state.candidate} onOpenChange={state.setDialogOpen} disablePointerDismissal={busy}>
    <Dialog.Portal><Dialog.Backdrop className="update-dialog-backdrop" /><Dialog.Popup className="update-dialog" initialFocus={laterRef}>
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.Description>{busy ? state.status === "downloading" ? `Downloading ${APP_NAME} ${state.candidate?.version}. Keep the app open.` : `${APP_NAME} will close and restart to finish installing. This may take a moment.` : state.status === "readyToRestart" ? `The update is installed. Restart ${APP_NAME} to finish.` : `${APP_NAME} ${state.candidate?.version} is ready. Finish your current work before continuing. The app will close and restart during installation.`}</Dialog.Description>
      <div className="update-dialog-status" role="status" aria-live="polite">
        {state.status === "downloading" && <><p>{percentage === null ? `${(state.downloadedBytes / 1048576).toFixed(1)} MB downloaded` : `${percentage}% downloaded`}</p><Progress value={state.contentLength ? state.downloadedBytes : null} max={state.contentLength ?? 100} aria-label="Update download progress" /></>}
        {state.status === "installing" && <p>Installing and preparing to restart…</p>}
      </div>
      {state.candidate?.body && !busy && <Disclosure className="update-notes" title="What’s new"><p>{state.candidate.body}</p></Disclosure>}
      {state.error && <p className="update-error" role="alert">{state.status === "readyToRestart" ? "The app could not restart. Try again, or close and reopen it." : "The update could not be completed. Your installed version is still available. Check your connection and try again."}</p>}
      <div className="update-dialog-actions"><Button ref={laterRef} className="secondary-button" disabled={busy} onClick={() => state.setDialogOpen(false)}>Later</Button>
        <Button className="primary-button" disabled={busy || state.isChecking} onClick={() => void (state.status === "readyToRestart" ? state.restartApp() : state.installUpdate())}>{busy ? "Updating…" : state.status === "readyToRestart" ? "Restart now" : state.error ? "Retry update" : "Update and restart"}</Button>
      </div>
    </Dialog.Popup></Dialog.Portal>
  </Dialog.Root>;
}
