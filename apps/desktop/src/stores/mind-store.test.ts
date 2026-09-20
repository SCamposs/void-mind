import {
  appendMessage,
  createConversation,
  createWorkspace,
  type KnowledgeItem,
  type ModelDescriptor
} from "@void-mind/mind-core";
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
      codexLogin: { state: "idle" },
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

  it("reuses the selected empty conversation instead of creating another empty draft", () => {
    const empty = createConversation("New conversation");
    useMindStore.setState({
      conversations: [empty],
      selectedConversationId: empty.id,
      section: "home",
      navigationOpen: true
    });

    const conversationId = useMindStore.getState().createConversation("workspace-ignored");

    const state = useMindStore.getState();
    expect(conversationId).toBe(empty.id);
    expect(state.conversations).toEqual([empty]);
    expect(state.selectedConversationId).toBe(empty.id);
    expect(state.section).toBe("conversations");
    expect(state.navigationOpen).toBe(false);
  });

  it("creates a new conversation after the selected conversation has content", () => {
    const existing = appendMessage(createConversation("Started"), "user", "Hello");
    useMindStore.setState({
      conversations: [existing],
      selectedConversationId: existing.id
    });

    const conversationId = useMindStore.getState().createConversation();

    const state = useMindStore.getState();
    expect(conversationId).not.toBe(existing.id);
    expect(state.conversations).toHaveLength(2);
    expect(state.selectedConversationId).toBe(conversationId);
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

  it("preserves conversations without orphaned knowledge references when deleting a workspace", () => {
    const workspace = createWorkspace("Research");
    const conversation = {
      ...createConversation("Notes"),
      workspaceId: workspace.id,
      contextKnowledgeIds: ["knowledge-1"]
    };
    const knowledge: KnowledgeItem = {
      id: "knowledge-1",
      title: "Source",
      sourceFilename: "source.md",
      type: "markdown",
      workspaceId: workspace.id,
      addedAt: new Date().toISOString(),
      size: 12,
      managedPath: "managed/source.md",
      content: "Explicit context.",
      status: "ready"
    };
    useMindStore.setState({
      workspaces: [workspace],
      selectedWorkspaceId: workspace.id,
      conversations: [conversation],
      selectedConversationId: conversation.id,
      knowledge: [knowledge]
    });

    useMindStore.getState().deleteWorkspace(workspace.id);

    const state = useMindStore.getState();
    expect(state.workspaces).toEqual([]);
    expect(state.knowledge).toEqual([]);
    expect(state.conversations).toHaveLength(1);
    expect(state.conversations[0]).toMatchObject({
      id: conversation.id,
      contextKnowledgeIds: []
    });
    expect(state.conversations[0].workspaceId).toBeUndefined();
  });
});
