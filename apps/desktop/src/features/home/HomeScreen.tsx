import { ArrowRight, MessageSquareText, Plus, Shapes } from "lucide-react";
import { FormEvent, useState } from "react";
import { SelectControl } from "../../components/SelectControl";
import { useMindStore } from "../../stores/mind-store";

export function HomeScreen() {
  const state = useMindStore();
  const [prompt, setPrompt] = useState("");
  const recent = [...state.conversations]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 4);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const content = prompt.trim();
    if (!content) return;
    const conversationId = state.createConversation(state.selectedWorkspaceId ?? undefined);
    state.appendMessage("user", content);
    state.queueGeneration(conversationId);
    setPrompt("");
  };

  const connected = state.codexAccount?.state === "connected";
  const activeModel = state.models.find((model) => model.id === state.selectedModelId);

  return (
    <section className="home-screen">
      <div className="home-hero">
        <span className="quiet-label">Intelligence environment</span>
        <h1>Make room for thought.</h1>
        <p>Start with a question. Shape the context with a workspace when the work needs continuity.</p>
        <form className="home-composer" onSubmit={submit}>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Ask, explore, draft, or reason…"
            aria-label="Start a conversation"
            rows={3}
          />
          <div>
            <div className="home-context">
              <span>{activeModel?.displayName ?? (connected ? "Choose a model" : "Connect ChatGPT to begin")}</span>
              <SelectControl
                variant="compact"
                label="Workspace for new conversation"
                value={state.selectedWorkspaceId ?? ""}
                options={[
                  { value: "", label: "No workspace", detail: "Start without workspace context" },
                  ...state.workspaces.map((workspace) => ({ value: workspace.id, label: workspace.name, detail: "Workspace" }))
                ]}
                onChange={(value) => state.selectWorkspace(value || null)}
              />
            </div>
            <button type="submit" disabled={!prompt.trim() || !activeModel} aria-label="Start conversation">
              <ArrowRight size={18} />
            </button>
          </div>
        </form>
      </div>

      <div className="home-grid">
        <section className="home-panel">
          <header><h2>Recent</h2><button type="button" onClick={() => state.setSection("conversations")}>View all</button></header>
          {recent.length ? recent.map((conversation) => (
            <button className="home-row" type="button" key={conversation.id} onClick={() => state.selectConversation(conversation.id)}>
              <MessageSquareText size={15} />
              <span><strong>{conversation.title}</strong><small>{new Date(conversation.updatedAt).toLocaleDateString()}</small></span>
              <ArrowRight size={14} />
            </button>
          )) : <p className="section-empty">Your conversations will gather here.</p>}
        </section>

        <section className="home-panel">
          <header><h2>Workspaces</h2><button type="button" onClick={() => state.setSection("workspaces")}><Plus size={13} /> New</button></header>
          {state.workspaces.length ? state.workspaces.slice(0, 4).map((workspace) => (
            <button className="home-row" type="button" key={workspace.id} onClick={() => { state.selectWorkspace(workspace.id); state.setSection("workspaces"); }}>
              <Shapes size={15} />
              <span><strong>{workspace.name}</strong><small>{state.knowledge.filter((item) => item.workspaceId === workspace.id).length} sources</small></span>
              <ArrowRight size={14} />
            </button>
          )) : <p className="section-empty">Create a workspace for instructions and selected context.</p>}
        </section>
      </div>
    </section>
  );
}
