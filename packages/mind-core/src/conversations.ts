import type { Conversation, MindMessage } from "./types";

type Clock = () => string;
type IdFactory = () => string;

const now: Clock = () => new Date().toISOString();
const makeId: IdFactory = () =>
  globalThis.crypto?.randomUUID?.() ??
  `mind-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

function requiredText(value: string, label: string): string {
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) throw new Error(`${label} cannot be empty.`);
  return normalized;
}

export function titleFromMessage(content: string): string {
  const text = requiredText(content, "Message").replace(/\s+/g, " ");
  return text.length > 48 ? `${text.slice(0, 47).trimEnd()}…` : text;
}

export function createConversation(
  title = "New conversation",
  clock: Clock = now,
  idFactory: IdFactory = makeId
): Conversation {
  const createdAt = clock();
  return {
    id: idFactory(),
    title: requiredText(title, "Conversation title"),
    createdAt,
    updatedAt: createdAt,
    messages: [],
    archivedBranches: []
  };
}

export function renameConversation(
  conversation: Conversation,
  title: string,
  clock: Clock = now
): Conversation {
  return { ...conversation, title: requiredText(title, "Conversation title"), updatedAt: clock() };
}

export function appendMessage(
  conversation: Conversation,
  role: MindMessage["role"],
  content: string,
  options: Partial<Pick<MindMessage, "status">> = {},
  clock: Clock = now,
  idFactory: IdFactory = makeId
): Conversation {
  const createdAt = clock();
  const message: MindMessage = {
    id: idFactory(),
    role,
    content: options.status === "streaming" ? content : requiredText(content, "Message"),
    createdAt,
    status: options.status ?? "complete"
  };
  return {
    ...conversation,
    title:
      conversation.messages.length === 0 && role === "user"
        ? titleFromMessage(content)
        : conversation.title,
    updatedAt: createdAt,
    messages: [...conversation.messages, message]
  };
}

export function updateMessage(
  conversation: Conversation,
  messageId: string,
  update: Pick<MindMessage, "content" | "status">,
  clock: Clock = now
): Conversation {
  if (!conversation.messages.some((message) => message.id === messageId)) {
    throw new Error("Message was not found.");
  }
  const updatedAt = clock();
  return {
    ...conversation,
    updatedAt,
    messages: conversation.messages.map((message) =>
      message.id === messageId ? { ...message, ...update } : message
    )
  };
}

export function editUserMessage(
  conversation: Conversation,
  messageId: string,
  content: string,
  clock: Clock = now,
  idFactory: IdFactory = makeId
): Conversation {
  const index = conversation.messages.findIndex((message) => message.id === messageId);
  const original = conversation.messages[index];
  if (!original || original.role !== "user") throw new Error("Editable user message was not found.");
  const updatedAt = clock();
  const replacement: MindMessage = {
    ...original,
    id: idFactory(),
    content: requiredText(content, "Message"),
    editedAt: updatedAt,
    revisionOf: original.id,
    status: "complete"
  };
  return {
    ...conversation,
    updatedAt,
    messages: [...conversation.messages.slice(0, index), replacement],
    archivedBranches: [
      ...conversation.archivedBranches,
      {
        id: idFactory(),
        reason: "edit",
        forkedFromMessageId: original.id,
        createdAt: updatedAt,
        messages: conversation.messages.slice(index)
      }
    ]
  };
}

export function prepareRegeneration(
  conversation: Conversation,
  clock: Clock = now,
  idFactory: IdFactory = makeId
): Conversation {
  const index = conversation.messages.findLastIndex((message) => message.role === "assistant");
  if (index < 0) throw new Error("There is no assistant response to regenerate.");
  const target = conversation.messages[index];
  const updatedAt = clock();
  return {
    ...conversation,
    updatedAt,
    messages: conversation.messages.slice(0, index),
    archivedBranches: [
      ...conversation.archivedBranches,
      {
        id: idFactory(),
        reason: "regenerate",
        forkedFromMessageId: target.id,
        createdAt: updatedAt,
        messages: conversation.messages.slice(index)
      }
    ]
  };
}

export function deleteConversation(
  conversations: Conversation[],
  conversationId: string
): Conversation[] {
  return conversations.filter((conversation) => conversation.id !== conversationId);
}

export function searchConversations(
  conversations: Conversation[],
  query: string
): Conversation[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return conversations;
  return conversations.filter((conversation) =>
    [conversation.title, ...conversation.messages.map((message) => message.content)]
      .join("\n")
      .toLocaleLowerCase()
      .includes(normalized)
  );
}
