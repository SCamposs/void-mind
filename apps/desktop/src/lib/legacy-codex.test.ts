import { describe, expect, it } from "vitest";
import { DEFAULT_MIND_STATE } from "@void-mind/persistence";
import { createConversation } from "@void-mind/mind-core";
import { needsLegacyCodex } from "./legacy-codex";

describe("optional Codex compatibility", () => {
  it("does not start Codex for fresh ChatGPT or API connections", () => {
    expect(needsLegacyCodex(DEFAULT_MIND_STATE)).toBe(false);
    expect(needsLegacyCodex({ ...DEFAULT_MIND_STATE, defaultPreference: { providerId: "openai-api" } })).toBe(false);
  });
  it("preserves runtime availability for existing Codex bindings", () => {
    expect(needsLegacyCodex({ ...DEFAULT_MIND_STATE, conversations: [{ ...createConversation(), providerBinding: { providerId: "openai-codex", remoteThreadId: "thread" } }] })).toBe(true);
    expect(needsLegacyCodex({ ...DEFAULT_MIND_STATE, defaultPreference: { providerId: "openai-codex" } })).toBe(true);
  });
});
