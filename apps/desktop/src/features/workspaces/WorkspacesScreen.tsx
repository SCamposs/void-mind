import { Plus, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useMindStore } from "../../stores/mind-store";

export function WorkspacesScreen() {
  const state = useMindStore();
  const workspace = state.workspaces.find((item) => item.id === state.selectedWorkspaceId);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");

  useEffect(() => {
    setName(workspace?.name ?? "");
    setDescription(workspace?.description ?? "");
    setInstructions(workspace?.instructions ?? "");
  }, [workspace]);

  const create = (event: FormEvent) => {
    event.preventDefault();
    state.createWorkspace("Untitled workspace");
  };

  const save = () => {
    if (!workspace || !name.trim()) return;
    state.updateWorkspace(workspace.id, { name, description, instructions });
  };

  return (
    <section className="workspace-screen settings-surface">
      <header className="surface-heading">
        <div><h1>Workspaces</h1><p>Durable instructions and context for related conversations.</p></div>
        <form onSubmit={create}><button className="primary-button" type="submit"><Plus size={15} /> New workspace</button></form>
      </header>
      <div className="workspace-layout">
        <aside className="workspace-list">
          {state.workspaces.map((item) => (
            <button type="button" className={item.id === workspace?.id ? "is-active" : ""} key={item.id} onClick={() => state.selectWorkspace(item.id)}>
              <strong>{item.name}</strong><span>{state.conversations.filter((conversation) => conversation.workspaceId === item.id).length} conversations</span>
            </button>
          ))}
          {!state.workspaces.length && <p className="section-empty">No workspaces yet.</p>}
        </aside>
        {workspace ? (
          <div className="workspace-editor">
            <label className="field"><span>Name</span><input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} /></label>
            <label className="field"><span>Description</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What belongs here?" /></label>
            <label className="field"><span>Instructions</span><textarea rows={8} value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Guidance applied to conversations in this workspace." /></label>
            <label className="field">
              <span>Preferred intelligence</span>
              <select
                value={workspace.preference?.modelId ?? ""}
                onChange={(event) => {
                  const model = state.models.find((item) => item.id === event.target.value);
                  state.updateWorkspace(workspace.id, {
                    preference: model ? {
                      providerId: model.providerId,
                      modelId: model.id,
                      reasoningEffort: model.defaultReasoningEffort,
                      serviceTier: model.defaultServiceTier
                    } : undefined
                  });
                }}
              >
                <option value="">Use global default</option>
                {state.models.map((model) => <option key={model.id} value={model.id}>{model.displayName} · {model.providerId === "openai-codex" ? "Codex" : "local"}</option>)}
              </select>
              <small>Conversations inherit this unless you explicitly choose another model.</small>
            </label>
            <div className="button-row">
              <button className="primary-button" type="button" onClick={save}>Save changes</button>
              <button className="danger-button" type="button" onClick={() => state.deleteWorkspace(workspace.id)}><Trash2 size={14} /> Delete workspace</button>
            </div>
          </div>
        ) : <div className="workspace-blank"><h2>A room for ongoing work.</h2><p>Create a workspace to group conversations, instructions, and explicit knowledge sources.</p></div>}
      </div>
    </section>
  );
}
