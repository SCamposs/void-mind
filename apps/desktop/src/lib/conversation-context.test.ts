import { createConversation, createWorkspace, type KnowledgeItem } from "@void-mind/mind-core";
import { describe, expect, it } from "vitest";
import { conversationContext, MAX_CONTEXT_CHARACTERS } from "./conversation-context";

describe("explicit conversation context", () => {
  const workspace = { ...createWorkspace("Research"), id: "research", instructions: "Explain clearly." };
  const conversation = { ...createConversation(), workspaceId: workspace.id, contextKnowledgeIds: ["chosen", "foreign", "failed"] };
  const source = (id: string, workspaceId = workspace.id): KnowledgeItem => ({
    id, workspaceId, title: id, sourceFilename: `${id}.txt`, type: "text", addedAt: "2026-10-28", size: 7,
    managedPath: `managed/${id}.txt`, content: "Content", status: "ready"
  });

  it("includes only ready, selected sources belonging to the conversation workspace", () => {
    const failed = { ...source("failed"), status: "error" as const };
    expect(conversationContext(conversation, workspace, [source("chosen"), source("unselected"), source("foreign", "other"), failed]))
      .toBe("Explain clearly.\n\nKnowledge source: chosen\nContent");
    expect(conversationContext(conversation, undefined, [source("chosen")])).toBe("");
    expect(conversationContext(conversation, { ...workspace, id: "other" }, [source("chosen")])).toBe("");
  });

  it("accepts the exact character limit and rejects overflow without truncation", () => {
    const exact = { ...workspace, instructions: "x".repeat(MAX_CONTEXT_CHARACTERS) };
    expect(conversationContext(conversation, exact, [])).toHaveLength(MAX_CONTEXT_CHARACTERS);
    expect(() => conversationContext(conversation, exact, [source("chosen")])).toThrow("Nothing was sent");
  });
});
