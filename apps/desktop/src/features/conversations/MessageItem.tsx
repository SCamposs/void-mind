import { Check, Copy, Edit3, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import type { MindMessage } from "@void-mind/mind-core";
import { copyText } from "../../lib/copy-text";
import { MarkdownMessage } from "./MarkdownMessage";

type MessageItemProps = {
  message: MindMessage;
  canRegenerate: boolean;
  disabled: boolean;
  onEdit(messageId: string, content: string): void;
  onRegenerate(): void;
};

export function MessageItem({
  message,
  canRegenerate,
  disabled,
  onEdit,
  onRegenerate
}: MessageItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await copyText(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_200);
  };

  return (
    <article className={`message message-${message.role}`}>
      <div className="message-role">{message.role === "user" ? "You" : "Mind"}</div>
      <div className="message-content">
        {editing ? (
          <form
            className="message-edit"
            onSubmit={(event) => {
              event.preventDefault();
              if (!draft.trim()) return;
              onEdit(message.id, draft);
              setEditing(false);
            }}
          >
            <label>
              <span className="sr-only">Edit message</span>
              <textarea
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={Math.min(10, Math.max(3, draft.split("\n").length))}
              />
            </label>
            <div>
              <button className="text-button" type="submit">
                <Check size={14} /> Save and continue
              </button>
              <button className="text-button" type="button" onClick={() => setEditing(false)}>
                <X size={14} /> Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            {message.status === "streaming" && !message.content ? (
              <div className="thinking-line" role="status">
                <span />
                Thinking…
              </div>
            ) : (
              <MarkdownMessage content={message.content} />
            )}
            {message.status === "stopped" && <p className="message-status">Generation stopped.</p>}
            {message.status === "error" && <p className="message-status">Response interrupted.</p>}
            <div className="message-actions">
              <button type="button" onClick={copy} aria-label="Copy message">
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy"}
              </button>
              {message.role === "user" && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setDraft(message.content);
                    setEditing(true);
                  }}
                >
                  <Edit3 size={14} /> Edit
                </button>
              )}
              {canRegenerate && (
                <button type="button" disabled={disabled} onClick={onRegenerate}>
                  <RefreshCw size={14} /> Regenerate
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </article>
  );
}
