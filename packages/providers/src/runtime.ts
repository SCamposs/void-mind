import type { LocalRuntimeConfig } from "@void-mind/mind-core";

export type ManagedRuntimeStatus = {
  running: boolean;
  state: "loading" | "running" | "stopped" | "crashed";
  executablePath?: string;
  modelPath?: string;
  port?: number;
  startedAt?: number;
  exitCode?: number;
};

export type ManagedRuntimeBridge = {
  validate(config: LocalRuntimeConfig): Promise<ManagedRuntimeStatus>;
  start(config: LocalRuntimeConfig): Promise<ManagedRuntimeStatus>;
  status(): Promise<ManagedRuntimeStatus>;
  stop(): Promise<ManagedRuntimeStatus>;
};
