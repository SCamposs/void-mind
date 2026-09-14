import { Plus, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useMindStore } from "../../stores/mind-store";
import { deleteKnowledgeFile } from "../../lib/knowledge-bridge";
import { SelectControl } from "../../components/SelectControl";

export function WorkspacesScreen() {
  const state = useMindStore();
  const workspace = state.workspaces.find((item) => item.id === state.selectedWorkspaceId);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [preferenceModelId, setPreferenceModelId] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setName(workspace?.name ?? "");
    setDescription(workspace?.description ?? "");
    setInstructions(workspace?.instructions ?? "");
    setPreferenceModelId(workspace?.preference?.modelId ?? "");
    setConfirmDelete(false);
    setError("");
  }, [workspace]);

  const create = (event: FormEvent) => {
    event.preventDefault();
    state.createWorkspace("Untitled workspace");
  };

  const save = () => {
    if (!workspace || !name.trim()) return;
    const model = state.models.find((item) => item.id === preferenceModelId);
    state.updateWorkspace(workspace.id, {
      name,
      description,
      instructions,
      preference: model ? {
        providerId: model.providerId,
        modelId: model.id,
        reasoningEffort: model.defaultReasoningEffort,
        serviceTier: model.defaultServiceTier
      } : undefined
    });
  };

  const remove = async () => {
    if (!workspace) return;
    setError("");
    try {
      const sources = state.knowledge.filter((item) => item.workspaceId === workspace.id);
      await Promise.all(sources.map((item) => deleteKnowledgeFile(item.id)));
      state.deleteWorkspace(workspace.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
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
            <div className="field">
              <span>Preferred intelligence</span>
              <SelectControl
                label="Preferred intelligence"
                value={preferenceModelId}
                options={[
                  { value: "", label: "Use global default", detail: "Follow the app preference" },
                  ...state.models.map((model) => ({
                    value: model.id,
                    label: model.displayName,
                    detail: model.providerId === "openai-codex" ? "OpenAI Codex" : "Local runtime"
                  }))
                ]}
                onChange={setPreferenceModelId}
              />
              <small>Conversations inherit this unless you explicitly choose another model.</small>
            </div>
            <div className="button-row">
              <button className="primary-button" type="button" onClick={save}>Save changes</button>
              {confirmDelete ? (
                <div className="inline-confirm"><span>Delete this workspace and its imported copies?</span><button type="button" onClick={() => void remove()}>Delete</button><button type="button" onClick={() => setConfirmDelete(false)}>Keep</button></div>
              ) : <button className="danger-button" type="button" onClick={() => setConfirmDelete(true)}><Trash2 size={14} /> Delete workspace</button>}
            </div>
            {error && <p className="inline-error" role="alert">{error}</p>}
          </div>
        ) : <div className="workspace-blank"><h2>A room for ongoing work.</h2><p>Create a workspace to group conversations, instructions, and explicit knowledge sources.</p></div>}
      </div>
    </section>
  );
}
