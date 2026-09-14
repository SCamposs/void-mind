import { FileText, Plus, Trash2 } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import { SelectControl } from "../../components/SelectControl";
import { deleteKnowledgeFile, importKnowledgeFile } from "../../lib/knowledge-bridge";
import { useMindStore } from "../../stores/mind-store";

export function KnowledgeScreen() {
  const state = useMindStore();
  const [message, setMessage] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const workspace = state.workspaces.find((item) => item.id === state.selectedWorkspaceId);
  const items = workspace ? state.knowledge.filter((item) => item.workspaceId === workspace.id) : [];

  const add = async () => {
    if (!workspace) return;
    setMessage("");
    try {
      const selected = await open({ multiple: false, directory: false, filters: [{ name: "Text knowledge", extensions: ["md", "txt"] }] });
      if (typeof selected !== "string") return;
      const id = crypto.randomUUID();
      const imported = await importKnowledgeFile(selected, id);
      state.addKnowledge({
        id,
        title: imported.sourceFilename.replace(/\.(md|txt)$/i, ""),
        sourceFilename: imported.sourceFilename,
        type: imported.fileType,
        workspaceId: workspace.id,
        addedAt: new Date().toISOString(),
        size: imported.size,
        managedPath: imported.managedPath,
        content: imported.content,
        status: "ready"
      });
      setMessage("Source imported as an app-managed copy. The original file was not changed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteKnowledgeFile(id);
      state.deleteKnowledge(id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <section className="settings-surface knowledge-screen">
      <header className="surface-heading">
        <div><h1>Knowledge</h1><p>Explicit Markdown and text sources, scoped to a workspace.</p></div>
        <button className="primary-button" type="button" disabled={!workspace} onClick={() => void add()}><Plus size={15} /> Import source</button>
      </header>
      <div className="knowledge-toolbar">
        <div className="field">
          <span>Workspace</span>
          <SelectControl
            label="Knowledge workspace"
            value={workspace?.id ?? ""}
            options={[
              { value: "", label: "Choose a workspace", detail: "No workspace selected" },
              ...state.workspaces.map((item) => ({ value: item.id, label: item.name, detail: "Workspace" }))
            ]}
            onChange={(value) => state.selectWorkspace(value || null)}
          />
        </div>
        <p>Only sources you select are included. Imported content is visible before use in a conversation.</p>
      </div>
      {message && <div className="status-message" role="status">{message}</div>}
      <div className="knowledge-list">
        {items.map((item) => (
          <article key={item.id}>
            <FileText size={18} />
            <div><h2>{item.title}</h2><p>{item.sourceFilename} · {(item.size / 1024).toFixed(1)} KB</p><pre>{item.content.slice(0, 280)}{item.content.length > 280 ? "…" : ""}</pre></div>
            {deletingId === item.id ? (
              <div className="knowledge-confirm"><span>Remove?</span><button type="button" onClick={() => void remove(item.id)}>Yes</button><button type="button" onClick={() => setDeletingId(null)}>No</button></div>
            ) : <button type="button" onClick={() => setDeletingId(item.id)} aria-label={`Remove ${item.title}`}><Trash2 size={15} /></button>}
          </article>
        ))}
        {workspace && !items.length && <p className="section-empty">No sources imported into this workspace.</p>}
        {!workspace && <p className="section-empty">Choose or create a workspace before importing knowledge.</p>}
      </div>
    </section>
  );
}
