import type { Conversation, KnowledgeItem, Workspace } from "@void-mind/mind-core";

// Character budget, not an estimate of the provider's token window.
export const MAX_CONTEXT_CHARACTERS = 64_000;

export function conversationContext(
  conversation: Conversation,
  workspace: Workspace | undefined,
  knowledge: KnowledgeItem[]
): string {
  if (!workspace || workspace.id !== conversation.workspaceId) return "";
  const sources = knowledge.filter((item) =>
    item.workspaceId === workspace.id && item.status === "ready" &&
    conversation.contextKnowledgeIds?.includes(item.id)
  );
  const context = [
    workspace.instructions,
    ...sources.map((item) => `Knowledge source: ${item.title}\n${item.content}`)
  ].filter(Boolean).join("\n\n");
  if (context.length > MAX_CONTEXT_CHARACTERS) {
    throw new Error("Selected workspace context exceeds 64,000 characters. Deselect sources or shorten workspace instructions before sending. Nothing was sent to the provider.");
  }
  return context;
}
