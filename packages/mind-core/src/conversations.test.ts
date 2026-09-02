import { describe, expect, it } from "vitest";
import {
  appendMessage,
  createConversation,
  deleteConversation,
  editUserMessage,
  prepareRegeneration,
  renameConversation,
  searchConversations
} from "./conversations";

const clock = () => "2026-01-01T00:00:00.000Z";
let sequence = 0;
const id = () => `id-${++sequence}`;

describe("conversation mutations", () => {
  it("creates, titles, renames, searches, and deletes conversations", () => {
    sequence = 0;
    let conversation = createConversation("New conversation", clock, id);
    conversation = appendMessage(conversation, "user", "A useful first question", {}, clock, id);
    expect(conversation.title).toBe("A useful first question");
    conversation = renameConversation(conversation, "Research notes", clock);
    expect(searchConversations([conversation], "useful")).toHaveLength(1);
    expect(deleteConversation([conversation], conversation.id)).toEqual([]);
  });

  it("preserves displaced messages as a future branch when editing", () => {
    sequence = 0;
    let conversation = createConversation("Chat", clock, id);
    conversation = appendMessage(conversation, "user", "Old prompt", {}, clock, id);
    const userId = conversation.messages[0].id;
    conversation = appendMessage(conversation, "assistant", "Old answer", {}, clock, id);
    const edited = editUserMessage(conversation, userId, "New prompt", clock, id);
    expect(edited.messages).toHaveLength(1);
    expect(edited.messages[0].content).toBe("New prompt");
    expect(edited.archivedBranches[0].messages).toHaveLength(2);
  });

  it("archives the previous assistant response before regeneration", () => {
    sequence = 0;
    let conversation = createConversation("Chat", clock, id);
    conversation = appendMessage(conversation, "user", "Prompt", {}, clock, id);
    conversation = appendMessage(conversation, "assistant", "Answer", {}, clock, id);
    const prepared = prepareRegeneration(conversation, clock, id);
    expect(prepared.messages.map((message) => message.role)).toEqual(["user"]);
    expect(prepared.archivedBranches[0].reason).toBe("regenerate");
  });
});
