import { describe, expect, it } from "vitest";
import { createConversation } from "@void-mind/mind-core";
import {
  DEFAULT_MIND_STATE,
  MIND_STORAGE_KEY,
  loadMindState,
  migrateMindState,
  saveMindState
} from "./index";

class MemoryStorage {
  value: string | null = null;
  getItem() { return this.value; }
  setItem(_key: string, value: string) { this.value = value; }
  removeItem() { this.value = null; }
}

describe("versioned persistence", () => {
  it("returns defaults for malformed data", () => {
    expect(migrateMindState("broken").runtime.endpoint).toBe("http://127.0.0.1:8080");
    const storage = new MemoryStorage();
    storage.value = "{";
    expect(loadMindState(storage).profiles).toHaveLength(4);
  });

  it("migrates an older partial chat state", () => {
    const state = migrateMindState({
      activeChatId: "chat-1",
      chats: [{
        id: "chat-1",
        title: "Local AI",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        messages: []
      }],
      runtime: { endpoint: "http://localhost:9090" }
    });
    expect(state.selectedConversationId).toBe("chat-1");
    expect(state.runtime.endpoint).toBe("http://localhost:9090");
    expect(state.workspaces).toEqual([]);
    expect(state.defaultPreference.providerId).toBe("openai-codex");
  });

  it("persists workspace ownership, instructions, and explicit knowledge context", () => {
    const state = migrateMindState({
      workspaces: [{
        id: "workspace-1",
        name: "Study",
        description: "Course notes",
        instructions: "Explain concepts simply.",
        preference: { providerId: "openai-codex", modelId: "codex:model" },
        createdAt: "2026-09-02T00:00:00.000Z",
        updatedAt: "2026-09-02T00:00:00.000Z"
      }],
      selectedWorkspaceId: "workspace-1",
      knowledge: [{
        id: "knowledge-1",
        title: "Notes",
        sourceFilename: "notes.md",
        type: "markdown",
        workspaceId: "workspace-1",
        addedAt: "2026-09-02T00:00:00.000Z",
        size: 42,
        managedPath: "knowledge/knowledge-1.md",
        content: "# Notes",
        status: "ready"
      }]
    });
    expect(state.selectedWorkspaceId).toBe("workspace-1");
    expect(state.workspaces[0].instructions).toBe("Explain concepts simply.");
    expect(state.knowledge[0].sourceFilename).toBe("notes.md");
  });

  it("drops knowledge whose workspace no longer exists", () => {
    const state = migrateMindState({
      knowledge: [{
        id: "knowledge-1",
        title: "Orphan",
        sourceFilename: "orphan.txt",
        type: "text",
        workspaceId: "missing",
        managedPath: "knowledge/knowledge-1.txt",
        content: "text"
      }]
    });
    expect(state.knowledge).toEqual([]);
  });

  it("repairs orphaned workspace and knowledge references in conversations", () => {
    const conversation = createConversation("Context");
    const state = migrateMindState({
      conversations: [
        { ...conversation, workspaceId: "missing", contextKnowledgeIds: ["knowledge-1"] },
        { ...createConversation("Valid"), id: "conversation-2", workspaceId: "workspace-1", contextKnowledgeIds: ["knowledge-1", "knowledge-2"] }
      ],
      workspaces: [{ id: "workspace-1", name: "Study" }],
      knowledge: [
        { id: "knowledge-1", title: "Notes", sourceFilename: "notes.md", type: "markdown", workspaceId: "workspace-1", managedPath: "knowledge/knowledge-1.md", content: "Notes" },
        { id: "knowledge-2", title: "Other", sourceFilename: "other.md", type: "markdown", workspaceId: "workspace-2", managedPath: "knowledge/knowledge-2.md", content: "Other" }
      ]
    });

    expect(state.conversations[0]).toMatchObject({ workspaceId: undefined, contextKnowledgeIds: [] });
    expect(state.conversations[1]).toMatchObject({
      workspaceId: "workspace-1",
      contextKnowledgeIds: ["knowledge-1"]
    });
  });

  it("persists conversations and omits them when retention is disabled", () => {
    const storage = new MemoryStorage();
    const conversation = createConversation();
    const state = {
      ...structuredClone(DEFAULT_MIND_STATE),
      conversations: [conversation],
      selectedConversationId: conversation.id
    };
    expect(saveMindState(storage, state)).toBe(true);
    expect(loadMindState(storage).conversations).toHaveLength(1);
    saveMindState(storage, {
      ...state,
      preferences: { ...state.preferences, retainConversations: false }
    });
    const raw = JSON.parse(storage.value ?? "{}");
    expect(raw.state.conversations).toEqual([]);
    expect(MIND_STORAGE_KEY).toContain("void-mind");
  });
});
