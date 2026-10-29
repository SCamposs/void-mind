import {
  appendMessage,
  createConversation,
  createWorkspace,
  type KnowledgeItem,
  type ModelDescriptor
} from "@void-mind/mind-core";
import { DEFAULT_MIND_STATE } from "@void-mind/persistence";
import { beforeEach, describe, expect, it } from "vitest";
import { globalModel, useMindStore } from "./mind-store";

describe("mind store streaming updates", () => {
  beforeEach(() => {
    useMindStore.setState({
      ...structuredClone(DEFAULT_MIND_STATE),
      draftConversation: null,
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

    const conversationId = useMindStore.getState().createConversation();

    const state = useMindStore.getState();
    expect(conversationId).toBe(empty.id);
    expect(state.conversations).toEqual([]);
    expect(state.draftConversation?.id).toBe(empty.id);
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
    expect(state.conversations).toHaveLength(1);
    expect(state.draftConversation?.id).toBe(conversationId);
    expect(state.selectedConversationId).toBe(conversationId);
  });

  it("reuses an empty draft in the requested workspace without carrying old context", () => {
    const empty = {
      ...createConversation("New conversation"),
      workspaceId: "old-workspace",
      contextKnowledgeIds: ["old-source"],
      providerOverride: { providerId: "old-provider" }
    };
    useMindStore.setState({ conversations: [empty], selectedConversationId: empty.id });
    const id = useMindStore.getState().createConversation("new-workspace");
    const state = useMindStore.getState();
    expect(id).toBe(empty.id);
    expect(state.conversations).toHaveLength(0);
    expect(state.draftConversation).toMatchObject({ workspaceId: "new-workspace", contextKnowledgeIds: [] });
    expect(state.draftConversation?.providerOverride).toBeUndefined();
  });

  it("saves one conversation only on the first message and carries draft context", () => {
    const first = useMindStore.getState().createConversation("workspace-1");
    expect(useMindStore.getState().createConversation("workspace-1")).toBe(first);
    expect(useMindStore.getState().conversations).toEqual([]);
    expect(JSON.parse(localStorage.getItem("void-mind:state") ?? "{}").state.conversations).toEqual([]);
    useMindStore.getState().setConversationOverride(first, { providerId: "openai-chatgpt", modelId: "actual-model" });
    useMindStore.getState().toggleConversationKnowledge(first, "selected-source");
    useMindStore.getState().appendMessage("user", "My first question");
    const current = useMindStore.getState();
    expect(current.draftConversation).toBeNull();
    expect(current.conversations).toHaveLength(1);
    expect(current.conversations[0]).toMatchObject({ id: first, title: "My first question", workspaceId: "workspace-1", contextKnowledgeIds: ["selected-source"], providerOverride: { providerId: "openai-chatgpt" } });
  });

  it("reuses the unsent draft after visiting another conversation", () => {
    const existing = appendMessage(createConversation(), "user", "Existing chat");
    useMindStore.setState({ conversations: [existing], selectedConversationId: existing.id });
    const draft = useMindStore.getState().createConversation();
    useMindStore.getState().selectConversation(existing.id);
    expect(useMindStore.getState().createConversation()).toBe(draft);
    expect(useMindStore.getState().conversations).toEqual([existing]);
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

  it("keeps global model options bound to the global preference across catalog selection changes", () => {
    const model = (providerId: string, isDefault = false): ModelDescriptor => ({
      id: `${providerId}:model`, displayName: "Model", identifier: "model", version: "test",
      providerId, location: "remote", languages: [], capabilities: [], isDefault
    });
    const legacy = { ...model("openai-codex", true), reasoningEfforts: [{ id: "low", description: "Low" }, { id: "high", description: "High" }] };
    const direct = model("openai-chatgpt", true);
    useMindStore.setState({
      models: [legacy, direct], selectedModelId: legacy.id,
      defaultPreference: { providerId: direct.providerId, modelId: direct.id }
    });
    expect(globalModel(useMindStore.getState())).toEqual(direct);
    expect(globalModel(useMindStore.getState())?.reasoningEfforts).toBeUndefined();
    useMindStore.getState().setProviderModels("openai-chatgpt", []);
    expect(globalModel(useMindStore.getState())).toBeUndefined();
    useMindStore.getState().setProviderModels("openai-chatgpt", [direct]);
    expect(useMindStore.getState().selectedModelId).toBe(legacy.id);
    expect(globalModel(useMindStore.getState())).toEqual(direct);
  });

  it("resolves only the global provider default when no model is chosen and never replaces a missing explicit model", () => {
    const legacy: ModelDescriptor = {
      id: "shared-id", displayName: "Legacy", identifier: "model", version: "test",
      providerId: "openai-codex", location: "remote", languages: [], capabilities: [], isDefault: true
    };
    const direct = { ...legacy, id: "direct-id", displayName: "Direct", providerId: "openai-chatgpt" };
    const models = [legacy, direct];
    expect(globalModel({ models, defaultPreference: { providerId: "openai-chatgpt" } })).toBe(direct);
    expect(globalModel({ models, defaultPreference: { providerId: "openai-chatgpt", modelId: "shared-id" } })).toBeUndefined();
  });
});
