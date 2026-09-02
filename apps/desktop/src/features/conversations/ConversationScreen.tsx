import { Brain, MessageSquarePlus, PanelLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LlamaServerProvider } from "@void-mind/providers";
import { useMindStore, activeSettings } from "../../stores/mind-store";
import { useMediaQuery } from "../../lib/use-media-query";
import { Composer } from "./Composer";
import { ConversationList } from "./ConversationList";
import { MessageItem } from "./MessageItem";

export function ConversationScreen() {
  const state = useMindStore();
  const [historyOpen, setHistoryOpen] = useState(false);
  const compactHistory = useMediaQuery("(max-width: 1040px)");
  const scroll = useRef<HTMLDivElement>(null);
  const historyPanel = useRef<HTMLDivElement>(null);
  const historyToggle = useRef<HTMLButtonElement>(null);
  const controller = useRef<AbortController | null>(null);
  const provider = useRef<LlamaServerProvider | null>(null);
  const activeAssistantId = useRef<string | null>(null);
  const conversation = useMemo(
    () => state.conversations.find((item) => item.id === state.selectedConversationId),
    [state.conversations, state.selectedConversationId]
  );
  const selectedModel = state.models.find((model) => model.id === state.selectedModelId);
  const generating = state.generationState === "connecting" || state.generationState === "generating";

  useEffect(() => {
    const element = scroll.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [conversation?.messages]);

  useEffect(() => () => controller.current?.abort(), []);

  useEffect(() => {
    setHistoryOpen(false);
  }, [state.selectedConversationId]);

  useEffect(() => {
    if (!compactHistory || !historyOpen) return;
    historyPanel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHistoryOpen(false);
        historyToggle.current?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [compactHistory, historyOpen]);

  const runGeneration = async () => {
    const snapshot = useMindStore.getState();
    const current = snapshot.conversations.find(
      (item) => item.id === snapshot.selectedConversationId
    );
    const model = snapshot.models.find((item) => item.id === snapshot.selectedModelId);
    if (!current || !model) return;

    const assistantId = snapshot.appendMessage("assistant", "", "streaming");
    activeAssistantId.current = assistantId;
    const abort = new AbortController();
    controller.current = abort;
    const localProvider = new LlamaServerProvider(snapshot.runtime.endpoint);
    provider.current = localProvider;
    snapshot.setGeneration("connecting");
    let content = "";

    try {
      for await (const event of localProvider.generate(
        {
          messages: current.messages,
          model,
          settings: activeSettings(useMindStore.getState())
        },
        abort.signal
      )) {
        if (event.type === "start") snapshot.setGeneration("generating");
        if (event.type === "token") {
          content += event.content;
          useMindStore.getState().updateMessage(assistantId, content, "streaming");
        }
        if (event.type === "error") throw new Error(event.message);
        if (event.type === "done") {
          useMindStore.getState().updateMessage(
            assistantId,
            content || "The local model returned an empty response.",
            "complete"
          );
          useMindStore.getState().setGeneration("idle");
        }
      }
      if (useMindStore.getState().generationState === "generating") {
        useMindStore.getState().updateMessage(
          assistantId,
          content || "The local model returned an empty response.",
          "complete"
        );
        useMindStore.getState().setGeneration("idle");
      }
    } catch (error) {
      if (abort.signal.aborted) {
        useMindStore.getState().updateMessage(assistantId, content, "stopped");
        useMindStore.getState().setGeneration("stopped");
      } else {
        const message = error instanceof Error ? error.message : "Generation failed.";
        useMindStore.getState().updateMessage(
          assistantId,
          content || "The response could not be completed.",
          "error"
        );
        useMindStore.getState().setGeneration("error", message);
      }
    } finally {
      controller.current = null;
      provider.current = null;
      activeAssistantId.current = null;
    }
  };

  const send = (content: string) => {
    state.appendMessage("user", content);
    void runGeneration();
  };

  const stop = () => {
    controller.current?.abort();
    provider.current?.cancel();
  };

  const regenerate = () => {
    state.prepareRegeneration();
    void runGeneration();
  };

  const edit = (messageId: string, content: string) => {
    state.editUserMessage(messageId, content);
    void runGeneration();
  };

  return (
    <section className="conversation-screen">
      <div
        ref={historyPanel}
        className={`history-panel ${historyOpen ? "is-open" : ""}`}
        aria-hidden={compactHistory && !historyOpen}
        inert={compactHistory && !historyOpen}
      >
        <ConversationList />
      </div>
      {historyOpen && (
        <button
          className="history-scrim"
          type="button"
          onClick={() => setHistoryOpen(false)}
          aria-label="Close conversation history"
        />
      )}
      <div className="conversation-main">
        <header className="conversation-header">
          <button
            ref={historyToggle}
            className="icon-button history-toggle"
            type="button"
            onClick={() => setHistoryOpen(!historyOpen)}
            aria-label="Open conversation history"
          >
            <PanelLeft size={18} />
          </button>
          <div>
            <h1>{conversation?.title ?? "Conversations"}</h1>
            <p>{selectedModel ? selectedModel.displayName : "No model active"}</p>
          </div>
        </header>

        {!selectedModel ? (
          <div className="conversation-empty">
            <Brain size={28} strokeWidth={1.35} aria-hidden="true" />
            <h2>No model is active.</h2>
            <p>Connect a local llama-server or configure a managed local model before starting.</p>
            <button className="primary-button" type="button" onClick={() => state.setSection("models")}>
              Configure a local model
            </button>
          </div>
        ) : !conversation || conversation.messages.length === 0 ? (
          <div className="conversation-empty">
            <MessageSquarePlus size={28} strokeWidth={1.35} aria-hidden="true" />
            <h2>What are you thinking about?</h2>
            <p>Ask, explore, draft, study, or reason with the active local model.</p>
          </div>
        ) : (
          <div className="messages" ref={scroll} aria-live="polite">
            <div className="message-column">
              {conversation.messages.map((message, index) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  disabled={generating}
                  canRegenerate={
                    message.role === "assistant" &&
                    index === conversation.messages.length - 1 &&
                    message.status !== "streaming"
                  }
                  onEdit={edit}
                  onRegenerate={regenerate}
                />
              ))}
              {state.generationError && (
                <div className="inline-error" role="alert">
                  <strong>Local response interrupted.</strong>
                  <span>{state.generationError}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <Composer
          models={state.models}
          selectedModelId={state.selectedModelId}
          generating={generating}
          disabled={!selectedModel}
          onModelChange={state.selectModel}
          onSend={send}
          onStop={stop}
        />
      </div>
    </section>
  );
}
