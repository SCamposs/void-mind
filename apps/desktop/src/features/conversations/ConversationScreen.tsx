import { BookOpen, Brain, MessageSquarePlus, PanelLeft, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveProviderPreference } from "@void-mind/mind-core";
import { CodexProvider, LlamaServerProvider, type MindProvider } from "@void-mind/providers";
import { codexBridge } from "../../lib/codex-bridge";
import { availableProviderIds } from "../../lib/provider-availability";
import { useMindStore, activeSettings } from "../../stores/mind-store";
import { useMediaQuery } from "../../lib/use-media-query";
import { Composer } from "./Composer";
import { ConversationList } from "./ConversationList";
import { MessageItem } from "./MessageItem";

export function ConversationScreen() {
  const state = useMindStore();
  const queuedGenerationId = state.queuedGenerationId;
  const queueGeneration = state.queueGeneration;
  const [historyOpen, setHistoryOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const compactHistory = useMediaQuery("(max-width: 1040px)");
  const scroll = useRef<HTMLDivElement>(null);
  const historyPanel = useRef<HTMLDivElement>(null);
  const historyToggle = useRef<HTMLButtonElement>(null);
  const contextPanel = useRef<HTMLElement>(null);
  const contextToggle = useRef<HTMLButtonElement>(null);
  const controller = useRef<AbortController | null>(null);
  const provider = useRef<MindProvider | null>(null);
  const activeAssistantId = useRef<string | null>(null);
  const conversation = useMemo(
    () => state.conversations.find((item) => item.id === state.selectedConversationId),
    [state.conversations, state.selectedConversationId]
  );
  const workspace = state.workspaces.find((item) => item.id === conversation?.workspaceId);
  const resolution = resolveProviderPreference({
    conversation,
    workspace,
    global: state.defaultPreference,
    availableProviderIds: availableProviderIds(state),
    availableModelIds: state.models.map((model) => model.id)
  });
  const selectedModel = state.models.find(
    (model) =>
      model.id === (resolution.preference.modelId ?? state.selectedModelId) &&
      model.providerId === resolution.preference.providerId
  ) ?? state.models.find(
    (model) => model.providerId === resolution.preference.providerId && model.isDefault
  );
  const generating = state.generationState === "connecting" || state.generationState === "generating";

  useEffect(() => {
    const element = scroll.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [conversation?.messages]);

  useEffect(() => () => controller.current?.abort(), []);

  useEffect(() => {
    setHistoryOpen(false);
    setContextOpen(false);
  }, [state.selectedConversationId]);

  useEffect(() => {
    if (!compactHistory || !historyOpen) return;
    historyPanel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const handleHistoryKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHistoryOpen(false);
        historyToggle.current?.focus();
      } else if (event.key === "Tab") {
        const focusable = [
          ...Array.from(historyPanel.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex='-1'])"
          ) ?? []),
          historyToggle.current
        ].filter((element): element is HTMLElement => Boolean(element));
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        } else if (!focusable.includes(document.activeElement as HTMLElement)) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleHistoryKeyDown);
    return () => window.removeEventListener("keydown", handleHistoryKeyDown);
  }, [compactHistory, historyOpen]);

  useEffect(() => {
    if (!contextOpen) return;
    contextPanel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setContextOpen(false);
      contextToggle.current?.focus();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [contextOpen]);

  const runGeneration = useCallback(async () => {
    const snapshot = useMindStore.getState();
    const current = snapshot.conversations.find(
      (item) => item.id === snapshot.selectedConversationId
    );
    if (!current) return;
    const currentWorkspace = snapshot.workspaces.find((item) => item.id === current.workspaceId);
    const providerResolution = resolveProviderPreference({
      conversation: current,
      workspace: currentWorkspace,
      global: snapshot.defaultPreference,
      availableProviderIds: availableProviderIds(snapshot),
      availableModelIds: snapshot.models.map((item) => item.id)
    });
    const model = snapshot.models.find((item) =>
      item.id === (providerResolution.preference.modelId ?? snapshot.selectedModelId) &&
      item.providerId === providerResolution.preference.providerId
    ) ?? snapshot.models.find((item) =>
      item.providerId === providerResolution.preference.providerId && item.isDefault
    );
    if (!providerResolution.available || !providerResolution.modelAvailable || !model) {
      snapshot.setGeneration("error", "The selected provider or model is unavailable. VOID Mind did not switch providers automatically.");
      return;
    }

    const assistantId = snapshot.appendMessage("assistant", "", "streaming");
    activeAssistantId.current = assistantId;
    const abort = new AbortController();
    controller.current = abort;
    const activeProvider: MindProvider = model.providerId === "openai-codex"
      ? new CodexProvider(codexBridge)
      : new LlamaServerProvider(snapshot.runtime.endpoint);
    provider.current = activeProvider;
    snapshot.setGeneration("connecting");
    let content = "";
    const selectedKnowledge = snapshot.knowledge.filter(
      (item) => current.contextKnowledgeIds?.includes(item.id) && item.workspaceId === current.workspaceId
    );
    const contextInstructions = [
      currentWorkspace?.instructions,
      ...selectedKnowledge.map((item) => `Knowledge source: ${item.title}\n${item.content}`)
    ].filter(Boolean).join("\n\n");
    const settings = activeSettings(snapshot);

    try {
      for await (const event of activeProvider.generate(
        {
          conversationId: current.id,
          messages: current.messages,
          model,
          settings,
          remoteThreadId:
            current.providerBinding?.providerId === model.providerId
              ? current.providerBinding.remoteThreadId
              : undefined,
          contextInstructions,
          reasoningEffort: providerResolution.preference.reasoningEffort ?? model.defaultReasoningEffort,
          serviceTier: providerResolution.preference.serviceTier ?? model.defaultServiceTier
        },
        abort.signal
      )) {
        if (event.type === "binding") {
          useMindStore.getState().setConversationBinding(current.id, {
            providerId: model.providerId,
            remoteThreadId: event.remoteThreadId
          });
        }
        if (event.type === "start") snapshot.setGeneration("generating");
        if (event.type === "token") {
          content += event.content;
          useMindStore.getState().updateMessage(assistantId, content, "streaming");
        }
        if (event.type === "error") throw new Error(event.message);
        if (event.type === "done") {
          useMindStore.getState().updateMessage(
            assistantId,
            content || "The provider returned an empty response.",
            "complete"
          );
          useMindStore.getState().setGeneration("idle");
        }
      }
      if (useMindStore.getState().generationState === "generating") {
        useMindStore.getState().updateMessage(
          assistantId,
          content || "The provider returned an empty response.",
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
  }, []);

  useEffect(() => {
    if (queuedGenerationId !== conversation?.id) return;
    queueGeneration(null);
    void runGeneration();
  }, [conversation?.id, queueGeneration, queuedGenerationId, runGeneration]);

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
            <p>{selectedModel ? `${selectedModel.displayName} · ${resolution.source}` : "No model active"}</p>
          </div>
          {conversation && workspace && (
            <button ref={contextToggle} className="context-button" type="button" onClick={() => setContextOpen(!contextOpen)} aria-expanded={contextOpen} aria-controls="conversation-context">
              <BookOpen size={15} /> Context
              {(conversation.contextKnowledgeIds?.length ?? 0) > 0 && <span>{conversation.contextKnowledgeIds?.length}</span>}
            </button>
          )}
        </header>

        {contextOpen && conversation && workspace && (
          <aside ref={contextPanel} id="conversation-context" className="context-panel" aria-label="Conversation context">
            <header><div><strong>{workspace.name}</strong><span>Workspace context</span></div><button type="button" onClick={() => { setContextOpen(false); contextToggle.current?.focus(); }} aria-label="Close context"><X size={15} /></button></header>
            {workspace.instructions && <p>{workspace.instructions}</p>}
            <div className="context-sources">
              {state.knowledge.filter((item) => item.workspaceId === workspace.id).map((item) => (
                <label key={item.id}>
                  <input type="checkbox" checked={conversation.contextKnowledgeIds?.includes(item.id) ?? false} onChange={() => state.toggleConversationKnowledge(conversation.id, item.id)} />
                  <span><strong>{item.title}</strong><small>{item.sourceFilename}</small></span>
                </label>
              ))}
              {!state.knowledge.some((item) => item.workspaceId === workspace.id) && <span className="section-empty">No knowledge sources in this workspace.</span>}
            </div>
          </aside>
        )}

        {!selectedModel ? (
          <div className="conversation-empty">
            <Brain size={28} strokeWidth={1.35} aria-hidden="true" />
            <h2>No model is active.</h2>
            <p>Connect ChatGPT through Codex or choose an available local model before starting.</p>
            <button className="primary-button" type="button" onClick={() => state.setSection("models")}>
              Configure intelligence
            </button>
          </div>
        ) : !conversation || conversation.messages.length === 0 ? (
          <div className="conversation-empty">
            <MessageSquarePlus size={28} strokeWidth={1.35} aria-hidden="true" />
            <h2>What are you thinking about?</h2>
            <p>Ask, explore, draft, study, or reason with the selected intelligence.</p>
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
                  <strong>Response interrupted.</strong>
                  <span>{state.generationError}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <Composer
          models={state.models}
          selectedModelId={selectedModel?.id ?? null}
          generating={generating}
          disabled={!selectedModel}
          privacyMessage={
            !selectedModel
              ? "Choose an intelligence provider to begin."
              : selectedModel.location === "remote"
              ? (conversation?.contextKnowledgeIds?.length ?? 0) > 0
                ? "Sent through Codex with the selected context."
                : "Sent through the official Codex runtime."
              : "Local model execution stays on this device."
          }
          onModelChange={(id) => {
            const model = state.models.find((item) => item.id === id);
            if (!model) return;
            if (conversation) {
              state.setConversationOverride(conversation.id, {
                providerId: model.providerId,
                modelId: model.id,
                reasoningEffort: model.defaultReasoningEffort,
                serviceTier: model.defaultServiceTier
              });
            } else {
              state.setDefaultPreference({ providerId: model.providerId, modelId: model.id });
            }
          }}
          onSend={send}
          onStop={stop}
        />
      </div>
    </section>
  );
}
