import { ArrowUp, Square } from "lucide-react";
import { useRef, useState } from "react";
import type { ModelDescriptor } from "@void-mind/mind-core";

type ComposerProps = {
  models: ModelDescriptor[];
  selectedModelId: string | null;
  generating: boolean;
  disabled: boolean;
  onModelChange(id: string): void;
  onSend(content: string): void;
  onStop(): void;
};

export function Composer({
  models,
  selectedModelId,
  generating,
  disabled,
  onModelChange,
  onSend,
  onStop
}: ComposerProps) {
  const [draft, setDraft] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    if (!draft.trim() || disabled || generating) return;
    onSend(draft);
    setDraft("");
    if (textarea.current) textarea.current.style.height = "";
  };

  return (
    <div className="composer-wrap">
      <div className="composer">
        <label>
          <span className="sr-only">Message VOID Mind</span>
          <textarea
            ref={textarea}
            value={draft}
            disabled={disabled}
            rows={1}
            placeholder={disabled ? "Configure a local model to begin" : "Write a message"}
            onChange={(event) => {
              setDraft(event.target.value);
              event.currentTarget.style.height = "auto";
              event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 180)}px`;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
          />
        </label>
        <div className="composer-footer">
          <label className="model-select">
            <span className="sr-only">Active model</span>
            <select
              value={selectedModelId ?? ""}
              disabled={!models.length || generating}
              onChange={(event) => onModelChange(event.target.value)}
            >
              {!models.length && <option value="">No model active</option>}
              {models.map((model) => (
                <option key={model.id} value={model.id}>{model.displayName}</option>
              ))}
            </select>
          </label>
          {generating ? (
            <button className="send-button stop-button" type="button" onClick={onStop}>
              <Square size={13} fill="currentColor" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              className="send-button"
              type="button"
              disabled={disabled || !draft.trim()}
              onClick={submit}
              aria-label="Send message"
            >
              <ArrowUp size={17} />
            </button>
          )}
        </div>
      </div>
      <p>Enter to send, Shift + Enter for a new line. Responses stay on this device.</p>
    </div>
  );
}
