import { ArrowUp, Square } from "lucide-react";
import { useRef, useState } from "react";
import type { ModelDescriptor } from "@void-mind/mind-core";
import { SelectControl } from "../../components/SelectControl";

type ComposerProps = {
  models: ModelDescriptor[];
  selectedModelId: string | null;
  generating: boolean;
  disabled: boolean;
  privacyMessage: string;
  onModelChange(id: string): void;
  onSend(content: string): void;
  onStop(): void;
};

export function Composer({
  models,
  selectedModelId,
  generating,
  disabled,
  privacyMessage,
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
            placeholder={disabled ? "Configure Intelligence to begin" : "Write a message"}
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
          <div className="model-select">
            <SelectControl
              variant="compact"
              label="Active model"
              value={selectedModelId ?? ""}
              disabled={!models.length || generating}
              placeholder="No model active"
              options={models.map((model) => ({
                value: model.id,
                label: model.displayName,
                detail: model.location === "remote" ? "OpenAI Codex" : "Local runtime"
              }))}
              onChange={onModelChange}
            />
          </div>
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
      <p>Enter to send, Shift + Enter for a new line. {privacyMessage}</p>
    </div>
  );
}
