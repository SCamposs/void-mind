import { describe, expect, it } from "vitest";
import type { ModelDescriptor } from "@void-mind/mind-core";
import { availableProviderIds } from "./provider-availability";

const model = (providerId: string): ModelDescriptor => ({
  id: `${providerId}:model`,
  displayName: "Model",
  identifier: "model",
  version: "test",
  providerId,
  location: providerId === "openai-codex" ? "remote" : "local",
  languages: [],
  capabilities: []
});

describe("provider availability", () => {
  it("requires a running Codex runtime, connected account, and discovered model", () => {
    const base = {
      models: [model("openai-codex")],
      codexStatus: { installed: true, running: true, state: "running" as const },
      codexAccount: { state: "connected" as const },
      providerHealth: null
    };

    expect(availableProviderIds(base)).toEqual(["openai-codex"]);
    expect(availableProviderIds({ ...base, codexAccount: { state: "disconnected" } })).toEqual([]);
    expect(availableProviderIds({ ...base, codexStatus: { ...base.codexStatus, running: false } })).toEqual([]);
    expect(availableProviderIds({ ...base, models: [] })).toEqual([]);
  });

  it("requires a healthy local runtime and discovered local model", () => {
    const base = {
      models: [model("void-local")],
      codexStatus: null,
      codexAccount: null,
      providerHealth: { ok: true, state: "ready" as const }
    };

    expect(availableProviderIds(base)).toEqual(["void-local"]);
    expect(availableProviderIds({ ...base, providerHealth: { ok: false, state: "offline" } })).toEqual([]);
  });
});
