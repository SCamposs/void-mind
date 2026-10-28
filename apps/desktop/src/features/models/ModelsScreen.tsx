import { ScrollSurface, Button, Input, NumberControl, SegmentedControl } from "../../components/Controls";
import { CheckCircle2, CircleAlert, FolderOpen, LoaderCircle, Play, Square } from "lucide-react";
import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { LlamaServerProvider } from "@void-mind/providers";
import { runtimeBridge } from "../../lib/runtime-bridge";
import { ConnectionsPanel } from "../../components/ConnectionsPanel";
import { useMindStore } from "../../stores/mind-store";
import { SelectControl } from "../../components/SelectControl";

type ActionState = "idle" | "working" | "success" | "error";

export function ModelsScreen() {
  const state = useMindStore();
  const [runtimeAction, setRuntimeAction] = useState<ActionState>("idle");
  const [runtimeMessage, setRuntimeMessage] = useState("");
  const selectedModel = state.models.find((model) => model.id === state.selectedModelId);
  const visibleModels = state.models.filter((model) => model.providerId !== "openai-codex" || state.defaultPreference.providerId === "openai-codex");

  const checkRuntime = async () => {
    setRuntimeAction("working");
    setRuntimeMessage("Checking the local runtime…");
    try {
      const provider = new LlamaServerProvider(state.runtime.endpoint);
      const health = await provider.health();
      state.setProviderHealth(health);
      if (!health.ok) {
        setRuntimeAction(health.state === "loading" ? "working" : "error");
        setRuntimeMessage(health.detail || "The local runtime is not ready.");
        return;
      }
      const models = await provider.models();
      state.setProviderModels("void-local", models);
      setRuntimeAction("success");
      setRuntimeMessage(
        models.length
          ? `Connected to ${models[0].displayName} on loopback.`
          : "The runtime is ready, but it did not report a model."
      );
    } catch (error) {
      state.setProviderHealth({
        ok: false,
        state: "error",
        detail: error instanceof Error ? error.message : "Runtime check failed."
      });
      setRuntimeAction("error");
      setRuntimeMessage(error instanceof Error ? error.message : "Runtime check failed.");
    }
  };

  const choosePath = async (kind: "runtime" | "model") => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters:
          kind === "model"
            ? [{ name: "GGUF model", extensions: ["gguf"] }]
            : [{ name: "llama-server", extensions: ["exe"] }]
      });
      if (typeof selected === "string") {
        state.updateRuntime(
          kind === "model" ? { modelPath: selected } : { executablePath: selected }
        );
      }
    } catch {
      setRuntimeAction("error");
      setRuntimeMessage("File selection is available in the installed desktop app.");
    }
  };

  const startManaged = async () => {
    setRuntimeAction("working");
    setRuntimeMessage("Starting the selected model on loopback…");
    try {
      await runtimeBridge.start(state.runtime);
      state.updateRuntime({
        endpoint: `http://127.0.0.1:${state.runtime.port}`
      });
      setRuntimeMessage("llama-server started. The model may need a moment to load.");
      window.setTimeout(() => void checkRuntime(), 900);
    } catch (error) {
      setRuntimeAction("error");
      setRuntimeMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const stopManaged = async () => {
    setRuntimeAction("working");
    setRuntimeMessage("Stopping the managed runtime…");
    try {
      await runtimeBridge.stop();
      state.setProviderHealth(null);
      setRuntimeAction("success");
      setRuntimeMessage("Managed runtime stopped.");
    } catch (error) {
      setRuntimeAction("error");
      setRuntimeMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <ScrollSurface className="settings-surface models-screen">
      <header className="surface-heading">
        <div>
          <h1>Intelligence</h1>
          <p>Connect ChatGPT, use an API key, or run a model locally.</p>
        </div>

      </header>

      <div className="settings-column">
        <ConnectionsPanel />

        <section className="settings-section">
          <div className="section-title">
            <h2>Local runtime</h2>
            <p>llama.cpp-compatible, loopback only</p>
          </div>
          <SegmentedControl label="Runtime mode" value={state.runtime.mode} onValueChange={(mode) => state.updateRuntime({ mode: mode === "managed" ? "managed" : "external" })} options={[{ value: "external", label: "Running server" }, { value: "managed", label: "Managed locally" }]} />

          {state.runtime.mode === "external" ? (
            <div className="field-stack">
              <label className="field">
                <span>Local endpoint</span>
                <Input
                  value={state.runtime.endpoint}
                  onChange={(event) => state.updateRuntime({ endpoint: event.target.value })}
                  spellCheck={false}
                />
                <small>Only localhost, 127.0.0.1, or ::1 over HTTP is accepted.</small>
              </label>
              <Button className="primary-button" type="button" onClick={() => void checkRuntime()}>
                Check local runtime
              </Button>
            </div>
          ) : (
            <div className="field-stack">
              <label className="field">
                <span>llama-server executable</span>
                <div className="path-field">
                  <Input
                    value={state.runtime.executablePath}
                    onChange={(event) => state.updateRuntime({ executablePath: event.target.value })}
                    placeholder="Select llama-server.exe"
                    spellCheck={false}
                  />
                  <Button type="button" onClick={() => void choosePath("runtime")} aria-label="Select llama-server executable">
                    <FolderOpen size={16} />
                  </Button>
                </div>
              </label>
              <label className="field">
                <span>GGUF model</span>
                <div className="path-field">
                  <Input
                    value={state.runtime.modelPath}
                    onChange={(event) => state.updateRuntime({ modelPath: event.target.value })}
                    placeholder="Select a .gguf file"
                    spellCheck={false}
                  />
                  <Button type="button" onClick={() => void choosePath("model")} aria-label="Select GGUF model">
                    <FolderOpen size={16} />
                  </Button>
                </div>
              </label>
              <div className="field-grid">
                <label className="field">
                  <span>Port</span>
                  <NumberControl
                    min={1024}
                    max={65535}
                    value={state.runtime.port}
                    onValueChange={(value) => state.updateRuntime({ port: value })}
                  />
                </label>
                <label className="field">
                  <span>Context</span>
                  <NumberControl
                    min={256}
                    value={state.runtime.context}
                    onValueChange={(value) => state.updateRuntime({ context: value })}
                  />
                </label>
                <label className="field">
                  <span>GPU layers</span>
                  <NumberControl
                    min={-1}
                    max={999}
                    value={state.runtime.gpuLayers}
                    onValueChange={(value) => state.updateRuntime({ gpuLayers: value })}
                  />
                </label>
              </div>
              <div className="button-row">
                <Button
                  className="primary-button"
                  type="button"
                  disabled={!state.runtime.executablePath || !state.runtime.modelPath}
                  onClick={() => void startManaged()}
                >
                  <Play size={15} /> Start local runtime
                </Button>
                <Button className="secondary-button" type="button" onClick={() => void stopManaged()}>
                  <Square size={13} /> Stop runtime
                </Button>
              </div>
            </div>
          )}

          {runtimeMessage && (
            <div className={`status-message is-${runtimeAction}`} role={runtimeAction === "error" ? "alert" : "status"}>
              {runtimeAction === "working" && <LoaderCircle className="spin" size={16} />}
              {runtimeAction === "success" && <CheckCircle2 size={16} />}
              {runtimeAction === "error" && <CircleAlert size={16} />}
              <span>{runtimeMessage}</span>
            </div>
          )}
        </section>

        <section className="settings-section">
          <div className="section-title">
            <h2>Available models</h2>
            <p>Models are discovered from your connections. API catalogs can include models that do not support text conversations.</p>
          </div>
          {visibleModels.length ? (
            <div className="model-list">
              {visibleModels.map((model) => (
                <Button
                  type="button"
                  key={model.id}
                  className={state.selectedModelId === model.id ? "is-active" : ""}
                  onClick={() => state.setDefaultPreference({
                    providerId: model.providerId,
                    modelId: model.id,
                    reasoningEffort: model.defaultReasoningEffort,
                    serviceTier: model.defaultServiceTier
                  })}
                >
                  <span>
                    <strong>{model.displayName}</strong>
                    <small>{model.providerId === "openai-codex" ? "Codex (legacy)" : model.providerId === "openai-chatgpt" ? "ChatGPT plan" : model.providerId === "openai-api" ? "OpenAI API" : model.format || "llama.cpp"} · {model.location}</small>
                  </span>
                  <span>{state.selectedModelId === model.id ? "Active" : "Use model"}</span>
                </Button>
              ))}
            </div>
          ) : (
            <p className="section-empty">No model metadata has been discovered yet.</p>
          )}
          {selectedModel && (
            <div className="model-options">
              {selectedModel.reasoningEfforts && selectedModel.reasoningEfforts.length > 0 && (
                <div className="field">
                  <span>Reasoning effort</span>
                  <SelectControl
                    label="Reasoning effort"
                    value={state.defaultPreference.reasoningEffort ?? selectedModel.defaultReasoningEffort ?? ""}
                    options={selectedModel.reasoningEfforts.map((effort) => ({ value: effort.id, label: effort.id }))}
                    onChange={(value) => state.setDefaultPreference({ ...state.defaultPreference, reasoningEffort: value || undefined })}
                  />
                </div>
              )}
              {selectedModel.serviceTiers && selectedModel.serviceTiers.length > 0 && (
                <div className="field">
                  <span>Service tier</span>
                  <SelectControl
                    label="Service tier"
                    value={state.defaultPreference.serviceTier ?? selectedModel.defaultServiceTier ?? ""}
                    options={selectedModel.serviceTiers.map((tier) => ({ value: tier.id, label: tier.name }))}
                    onChange={(value) => state.setDefaultPreference({ ...state.defaultPreference, serviceTier: value || undefined })}
                  />
                </div>
              )}
            </div>
          )}
          <p className="honesty-note">
            Availability depends on the selected connection. VOID Mind never switches to another provider automatically.
          </p>
        </section>
      </div>
    </ScrollSurface>
  );
}
