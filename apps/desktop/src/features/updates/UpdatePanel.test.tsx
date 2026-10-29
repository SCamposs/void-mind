import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UpdateDialog, UpdatePanel } from "./UpdatePanel";
import { useUpdateStore } from "./updateStore";
vi.stubGlobal("PointerEvent", MouseEvent);

const initial = useUpdateStore.getState();
afterEach(() => { cleanup(); useUpdateStore.setState(initial, true); });
function available() {
  const installUpdate = vi.fn();
  useUpdateStore.setState({ candidate: { version: "0.2.0-3", currentVersion: "0.2.0-2", body: "A focused update.", downloadAndInstall: vi.fn() }, status: "available", dialogOpen: true, installUpdate });
  return installUpdate;
}

describe("branded update flow", () => {
  it("explains restart, allows postponing and never installs on announcement", async () => {
    const install = available();
    render(<UpdateDialog />);
    expect(await screen.findByRole("dialog", { name: "An update is available" })).toHaveTextContent("close and restart");
    expect(install).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    expect(useUpdateStore.getState().dialogOpen).toBe(false);
    expect(install).not.toHaveBeenCalled();
  });
  it("installs only after the explicit action and reports actual download progress", async () => {
    const install = available();
    render(<UpdateDialog />);
    fireEvent.click(await screen.findByRole("button", { name: "Update and restart" }));
    expect(install).toHaveBeenCalledOnce();
    act(() => useUpdateStore.setState({ status: "downloading", contentLength: 100, downloadedBytes: 25 }));
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
    expect(screen.getByRole("button", { name: "Later" })).toBeDisabled();
    act(() => useUpdateStore.setState({ contentLength: null }));
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  });
  it("defers the popup while onboarding/other required dialogs are active", () => {
    available();
    render(<UpdateDialog enabled={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("offers a persistent manual preference in Settings", () => {
    render(<UpdatePanel />);
    fireEvent.click(screen.getByRole("switch", { name: "Check for updates automatically" }));
    expect(useUpdateStore.getState().automaticChecks).toBe(false);
    expect(localStorage.getItem("void-mind.updates.automatic.v1")).toBe("false");
    localStorage.removeItem("void-mind.updates.automatic.v1");
  });
});
