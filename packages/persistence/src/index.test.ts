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
