import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";

async function runWindowAction(action: "minimize" | "maximize" | "close") {
  const window = getCurrentWindow();
  if (action === "minimize") await window.minimize();
  if (action === "maximize") await window.toggleMaximize();
  if (action === "close") await window.close();
}

export function WindowControls() {
  if (!isTauri()) return null;

  return (
    <div className="window-controls" aria-label="Window controls">
      <button type="button" onClick={() => void runWindowAction("minimize")} aria-label="Minimize window">
        <Minus size={15} strokeWidth={1.6} aria-hidden="true" />
      </button>
      <button type="button" onClick={() => void runWindowAction("maximize")} aria-label="Maximize or restore window">
        <Square size={11} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <button className="window-close" type="button" onClick={() => void runWindowAction("close")} aria-label="Close window">
        <X size={15} strokeWidth={1.6} aria-hidden="true" />
      </button>
    </div>
  );
}
