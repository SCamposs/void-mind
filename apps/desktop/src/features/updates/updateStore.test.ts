import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createUpdateStore,
  scheduleUpdateChecks,
  UPDATE_CHECK_INTERVAL_MS,
  type UpdateCandidate,
} from "./updateStore";

function candidate(overrides: Partial<UpdateCandidate> = {}): UpdateCandidate {
  return {
    body: "Changes",
    currentVersion: "0.1.3-alpha",
    date: "2026-08-07T12:00:00Z",
    downloadAndInstall: vi.fn().mockResolvedValue(undefined),
    version: "0.1.4-alpha",
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("automatic updates", () => {
  it("checks immediately and every hour, and stops when cleaned up", async () => {
    vi.useFakeTimers();
    const runCheck = vi.fn().mockResolvedValue(undefined);
    const stop = scheduleUpdateChecks(runCheck);

    expect(runCheck).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL_MS * 2);
    expect(runCheck).toHaveBeenCalledTimes(3);

    stop();
    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL_MS);
    expect(runCheck).toHaveBeenCalledTimes(3);
    expect(UPDATE_CHECK_INTERVAL_MS).toBe(3_600_000);
  });

  it("refreshes an already available update on the hourly check", async () => {
    const check = vi.fn()
      .mockResolvedValueOnce(candidate({ version: "0.1.4-alpha" }))
      .mockResolvedValueOnce(candidate({ version: "0.1.5-alpha" }));
    const store = createUpdateStore({
      isDesktop: () => true,
      check,
      relaunch: vi.fn(),
    });

    await store.getState().checkForUpdates();
    await store.getState().checkForUpdates();

    expect(check).toHaveBeenCalledTimes(2);
    expect(store.getState().candidate?.version).toBe("0.1.5-alpha");
  });

  it("exposes an available update without installing it automatically", async () => {
    const update = candidate();
    const store = createUpdateStore({
      isDesktop: () => true,
      check: vi.fn().mockResolvedValue(update),
      relaunch: vi.fn().mockResolvedValue(undefined),
    });

    await store.getState().checkForUpdates();

    expect(store.getState().status).toBe("available");
    expect(store.getState().candidate?.version).toBe("0.1.4-alpha");
    expect(update.downloadAndInstall).not.toHaveBeenCalled();
    expect(store.getState().dialogOpen).toBe(true);
  });

  it("downloads, installs and relaunches only after confirmation", async () => {
    const downloadAndInstall = vi.fn(async (onEvent) => {
      onEvent?.({ event: "Started", data: { contentLength: 100 } });
      onEvent?.({ event: "Progress", data: { chunkLength: 100 } });
      onEvent?.({ event: "Finished" });
    });
    const relaunch = vi.fn().mockResolvedValue(undefined);
    const store = createUpdateStore({
      isDesktop: () => true,
      check: vi.fn().mockResolvedValue(candidate({ downloadAndInstall })),
      relaunch,
    });

    await store.getState().checkForUpdates();
    await store.getState().installUpdate();

    expect(downloadAndInstall).toHaveBeenCalledTimes(1);
    expect(relaunch).toHaveBeenCalledTimes(1);
    expect(store.getState().downloadedBytes).toBe(100);
    expect(store.getState().status).toBe("installing");
  });

  it("does not call the native updater in a browser preview", async () => {
    const check = vi.fn();
    const store = createUpdateStore({
      isDesktop: () => false,
      check,
      relaunch: vi.fn(),
    });

    await store.getState().checkForUpdates();

    expect(check).not.toHaveBeenCalled();
    expect(store.getState().status).toBe("unavailable");
  });

  it("remembers manual mode across launches and tolerates blocked storage", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
    const first = createUpdateStore();
    expect(first.getState().automaticChecks).toBe(true);
    first.getState().setAutomaticChecks(false);
    expect(createUpdateStore().getState().automaticChecks).toBe(false);
    vi.stubGlobal("localStorage", { getItem: () => { throw Error("blocked"); }, setItem: () => { throw Error("blocked"); } });
    const restricted = createUpdateStore();
    restricted.getState().setAutomaticChecks(false);
    expect(restricted.getState().automaticChecks).toBe(false);
  });

  it("does not reopen a deferred version on every check and releases replaced resources", async () => {
    const first = candidate({ close: vi.fn().mockResolvedValue(undefined) });
    const second = candidate();
    const store = createUpdateStore({ isDesktop: () => true, check: vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second).mockResolvedValueOnce(candidate({ version: "0.3.0-alpha" })), relaunch: vi.fn() });
    await store.getState().checkForUpdates();
    store.getState().setDialogOpen(false);
    await store.getState().checkForUpdates();
    expect(store.getState().dialogOpen).toBe(false);
    expect(first.close).toHaveBeenCalledOnce();
    await store.getState().checkForUpdates();
    expect(store.getState().dialogOpen).toBe(true);
  });

  it("keeps installation failure retryable and never restarts on download failure", async () => {
    const relaunch = vi.fn();
    const store = createUpdateStore({ isDesktop: () => true, check: vi.fn().mockResolvedValue(candidate({ downloadAndInstall: vi.fn().mockRejectedValue(Error("network")) })), relaunch });
    await store.getState().checkForUpdates();
    await store.getState().installUpdate();
    expect(store.getState().status).toBe("available");
    expect(store.getState().error).toBe("network");
    expect(relaunch).not.toHaveBeenCalled();
  });

  it("retries only restart after successful installation and a failed relaunch", async () => {
    const downloadAndInstall = vi.fn().mockResolvedValue(undefined);
    const relaunch = vi.fn().mockRejectedValueOnce(Error("restart failed")).mockResolvedValue(undefined);
    const store = createUpdateStore({ isDesktop: () => true, check: vi.fn().mockResolvedValue(candidate({ downloadAndInstall })), relaunch });
    await store.getState().checkForUpdates();
    await store.getState().installUpdate();
    expect(store.getState().status).toBe("readyToRestart");
    await store.getState().restartApp();
    expect(downloadAndInstall).toHaveBeenCalledOnce();
    expect(relaunch).toHaveBeenCalledTimes(2);
  });

  it("prevents overlapping checks, duplicate installs and dismissing an active download", async () => {
    let finish!: () => void;
    const downloadAndInstall = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const check = vi.fn().mockResolvedValue(candidate({ downloadAndInstall }));
    const store = createUpdateStore({ isDesktop: () => true, check, relaunch: vi.fn() });
    await Promise.all([store.getState().checkForUpdates(), store.getState().checkForUpdates()]);
    expect(check).toHaveBeenCalledOnce();
    const pending = store.getState().installUpdate();
    await store.getState().installUpdate();
    await store.getState().checkForUpdates();
    store.getState().setDialogOpen(false);
    expect(store.getState().dialogOpen).toBe(true);
    expect(downloadAndInstall).toHaveBeenCalledOnce();
    expect(check).toHaveBeenCalledOnce();
    finish();
    await pending;
  });
});
