import { appendMessage, createConversation, type ModelDescriptor } from "@void-mind/mind-core";
import { DEFAULT_MIND_STATE } from "@void-mind/persistence";
import { beforeEach, describe, expect, it } from "vitest";
import { useMindStore } from "./mind-store";

describe("mind store streaming updates", () => {
  beforeEach(() => {
    useMindStore.setState({
      ...structuredClone(DEFAULT_MIND_STATE),
      section: "home",
      navigationOpen: false,
      generationState: "idle",
      generationError: null,
      providerHealth: null,
      codexStatus: null,
      codexAccount: null,
      queuedGenerationId: null,
      storageHealthy: true
    });
  });

  it("updates the conversation that owns a streaming message after selection changes", () => {
    const first = appendMessage(createConversation("First"), "assistant", "", {
      status: "streaming"
    });
    const second = createConversation("Second");
    const messageId = first.messages[0].id;
    useMindStore.setState({
      conversations: [first, second],
      selectedConversationId: second.id
    });

    useMindStore.getState().updateMessage(messageId, "Finished", "complete");

    const state = useMindStore.getState();
    expect(state.conversations.find((item) => item.id === first.id)?.messages[0]).toMatchObject({
      content: "Finished",
      status: "complete"
    });
    expect(state.conversations.find((item) => item.id === second.id)?.messages).toEqual([]);
  });

  it("does not silently select a model from another provider when a catalog disappears", () => {
    const makeModel = (providerId: string): ModelDescriptor => ({
      id: `${providerId}:model`,
      displayName: "Model",
      identifier: "model",
      version: "test",
      providerId,
      location: providerId === "openai-codex" ? "remote" : "local",
      languages: [],
      capabilities: []
    });
    const codex = makeModel("openai-codex");
    const local = makeModel("void-local");
    useMindStore.setState({
      models: [codex, local],
      selectedModelId: codex.id,
      selectedProviderId: "openai-codex",
      defaultPreference: { providerId: "openai-codex", modelId: codex.id }
    });

    useMindStore.getState().setProviderModels("openai-codex", []);

    const state = useMindStore.getState();
    expect(state.models).toEqual([local]);
    expect(state.selectedModelId).toBeNull();
    expect(state.selectedProviderId).toBe("openai-codex");
    expect(state.defaultPreference).toEqual({ providerId: "openai-codex", modelId: codex.id });
  });
});
