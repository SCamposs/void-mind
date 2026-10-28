import { Button, Input, ScrollSurface } from "../../components/Controls";
import { Check, Edit3, Pin, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { searchConversations, type Conversation } from "@void-mind/mind-core";
import { useMindStore } from "../../stores/mind-store";

function groupLabel(conversation: Conversation, now = new Date()): string {
  if (conversation.pinned) return "Pinned";
  const updated = new Date(conversation.updatedAt);
  if (updated.toDateString() === now.toDateString()) return "Today";
  if (now.getTime() - updated.getTime() < 7 * 24 * 60 * 60 * 1000) return "Previous 7 days";
  return "Older";
}

export function ConversationList() {
  const conversations = useMindStore((state) => state.conversations);
  const selectedId = useMindStore((state) => state.selectedConversationId);
  const selectedWorkspaceId = useMindStore((state) => state.selectedWorkspaceId);
  const create = useMindStore((state) => state.createConversation);
  const select = useMindStore((state) => state.selectConversation);
  const rename = useMindStore((state) => state.renameConversation);
  const remove = useMindStore((state) => state.deleteConversation);
  const pin = useMindStore((state) => state.pinConversation);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const filtered = useMemo(
    () => [...searchConversations(conversations, query)].sort((a, b) =>
      Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt.localeCompare(a.updatedAt)
    ),
    [conversations, query]
  );
  const groups = useMemo(() => {
    const result = new Map<string, Conversation[]>();
    for (const conversation of filtered) {
      const label = groupLabel(conversation);
      result.set(label, [...(result.get(label) ?? []), conversation]);
    }
    return [...result];
  }, [filtered]);
  const currentWorkspaceId = conversations.find((item) => item.id === selectedId)?.workspaceId;

  const beginRename = (id: string, title: string) => {
    setEditingId(id);
    setDraft(title);
    setDeletingId(null);
  };

  const commitRename = () => {
    if (!editingId || !draft.trim()) return;
    rename(editingId, draft);
    setEditingId(null);
  };

  return (
    <aside className="conversation-list" aria-label="Conversation history">
      <Button className="new-conversation" type="button" onClick={() => create(currentWorkspaceId ?? selectedWorkspaceId ?? undefined)}>
        <Plus size={16} />
        New conversation
      </Button>
      <label className="search-field">
        <Search size={15} aria-hidden="true" />
        <span className="sr-only">Search conversations</span>
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search conversations"
        />
      </label>
      <ScrollSurface className="conversation-scroll" label="Conversation history">
        {filtered.length === 0 ? (
          <p className="list-empty">{query ? "No matching conversations." : "No conversations yet."}</p>
        ) : (
          groups.map(([label, items]) => (
            <section className="conversation-group" key={label} aria-labelledby={`conversation-group-${label.replace(/\W+/g, "-").toLowerCase()}`}>
              <h2 id={`conversation-group-${label.replace(/\W+/g, "-").toLowerCase()}`}>{label}</h2>
              {items.map((conversation) => <div
                key={conversation.id}
                className={`conversation-row ${selectedId === conversation.id ? "is-active" : ""}`}
              >
              {editingId === conversation.id ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    commitRename();
                  }}
                >
                  <Input
                    autoFocus
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    aria-label="Conversation name"
                  />
                  <Button type="submit" aria-label="Save name"><Check size={14} /></Button>
                  <Button type="button" onClick={() => setEditingId(null)} aria-label="Cancel rename">
                    <X size={14} />
                  </Button>
                </form>
              ) : deletingId === conversation.id ? (
                <div className="inline-confirm">
                  <span>Delete?</span>
                  <Button type="button" onClick={() => remove(conversation.id)}>Delete</Button>
                  <Button type="button" onClick={() => setDeletingId(null)}>Keep</Button>
                </div>
              ) : (
                <>
                  <Button
                    className="conversation-select"
                    type="button"
                    onClick={() => select(conversation.id)}
                  >
                    <strong>{conversation.title}</strong>
                    <span>{conversation.messages.at(-1)?.content || "Empty conversation"}</span>
                  </Button>
                  <div className="row-actions">
                    <Button
                      type="button"
                      className={conversation.pinned ? "is-pinned" : ""}
                      onClick={() => pin(conversation.id, !conversation.pinned)}
                      aria-label={conversation.pinned ? `Unpin ${conversation.title}` : `Pin ${conversation.title}`}
                    >
                      <Pin size={13} fill={conversation.pinned ? "currentColor" : "none"} />
                    </Button>
                    <Button
                      type="button"
                      onClick={() => beginRename(conversation.id, conversation.title)}
                      aria-label={`Rename ${conversation.title}`}
                    >
                      <Edit3 size={13} />
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        setDeletingId(conversation.id);
                        setEditingId(null);
                      }}
                      aria-label={`Delete ${conversation.title}`}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </>
              )}
              </div>)}
            </section>
          ))
        )}
      </ScrollSurface>
    </aside>
  );
}
