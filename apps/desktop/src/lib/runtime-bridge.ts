import { invoke } from "@tauri-apps/api/core";
import type { LocalRuntimeConfig } from "@void-mind/mind-core";
import type { ManagedRuntimeBridge, ManagedRuntimeStatus } from "@void-mind/providers";

const isTauri = () => "__TAURI_INTERNALS__" in globalThis;

function payload(config: LocalRuntimeConfig) {
  return {
    config: {
      executablePath: config.executablePath,
      modelPath: config.modelPath,
      port: config.port,
      context: config.context,
      gpuLayers: config.gpuLayers
    }
  };
}

async function unavailable(): Promise<ManagedRuntimeStatus> {
  throw new Error("Managed runtime controls are available in the desktop app.");
}

export const runtimeBridge: ManagedRuntimeBridge = {
  validate: (config) =>
    isTauri() ? invoke<ManagedRuntimeStatus>("validate_runtime", payload(config)) : unavailable(),
  start: (config) =>
    isTauri() ? invoke<ManagedRuntimeStatus>("start_runtime", payload(config)) : unavailable(),
  status: () =>
    isTauri() ? invoke<ManagedRuntimeStatus>("runtime_status") : unavailable(),
  stop: () =>
    isTauri() ? invoke<ManagedRuntimeStatus>("stop_runtime") : unavailable()
};
