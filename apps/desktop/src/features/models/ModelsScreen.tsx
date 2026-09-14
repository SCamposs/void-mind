import { CheckCircle2, CircleAlert, FolderOpen, LoaderCircle, LogIn, LogOut, Play, Square } from "lucide-react";
import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { LlamaServerProvider, normalizeCodexModels } from "@void-mind/providers";
import { codexBridge } from "../../lib/codex-bridge";
import { runtimeBridge } from "../../lib/runtime-bridge";
import { useMindStore } from "../../stores/mind-store";
import { SelectControl } from "../../components/SelectControl";

type ActionState = "idle" | "working" | "success" | "error";

export function ModelsScreen() {
  const state = useMindStore();
  const [action, setAction] = useState<ActionState>("idle");
  const [message, setMessage] = useState("");
  const [loginCode, setLoginCode] = useState<string | null>(null);
  const [loginId, setLoginId] = useState<string | null>(null);
  const selectedModel = state.models.find((model) => model.id === state.selectedModelId);

  const refreshCodex = async () => {
    const status = await codexBridge.start();
    state.setCodexStatus(status);
    const account = await codexBridge.account();
    state.setCodexAccount(account);
    if (account.state === "connected") {
      state.setProviderModels("openai-codex", normalizeCodexModels(await codexBridge.models()));
    }
  };

  const connectCodex = async (flow: "browser" | "deviceCode") => {
    setAction("working");
    setMessage("Starting secure ChatGPT sign-in through Codex…");
    try {
      const login = await codexBridge.beginLogin(flow);
      setLoginId(login.loginId);
      if (login.authUrl) await codexBridge.openAuthUrl(login.authUrl);
      if (login.verificationUrl) await codexBridge.openAuthUrl(login.verificationUrl);
      setLoginCode(login.userCode ?? null);
      setMessage(login.userCode ? "Enter this one-time code in the opened browser." : "Finish signing in in the opened browser.");
    } catch (error) {
      setAction("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const cancelLogin = async () => {
    if (!loginId) return;
    try {
      await codexBridge.cancelLogin(loginId);
      setLoginId(null);
      setLoginCode(null);
      setAction("idle");
      setMessage("Sign-in cancelled.");
    } catch (error) {
      setAction("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const disconnectCodex = async () => {
    setAction("working");
    try {
      await codexBridge.logout();
      await refreshCodex();
      setAction("success");
      setMessage("ChatGPT account disconnected from the Codex runtime.");
    } catch (error) {
      setAction("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const checkRuntime = async () => {
    setAction("working");
    setMessage("Checking the local runtime…");
    try {
      const provider = new LlamaServerProvider(state.runtime.endpoint);
      const health = await provider.health();
      state.setProviderHealth(health);
      if (!health.ok) {
        setAction(health.state === "loading" ? "working" : "error");
        setMessage(health.detail || "The local runtime is not ready.");
        return;
      }
      const models = await provider.models();
      state.setProviderModels("void-local", models);
      setAction("success");
      setMessage(
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
      setAction("error");
      setMessage(error instanceof Error ? error.message : "Runtime check failed.");
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
      setAction("error");
      setMessage("File selection is available in the installed desktop app.");
    }
  };

  const startManaged = async () => {
    setAction("working");
    setMessage("Starting the selected model on loopback…");
    try {
      await runtimeBridge.start(state.runtime);
      state.updateRuntime({
        endpoint: `http://127.0.0.1:${state.runtime.port}`
      });
      setMessage("llama-server started. The model may need a moment to load.");
      window.setTimeout(() => void checkRuntime(), 900);
    } catch (error) {
      setAction("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const stopManaged = async () => {
    setAction("working");
    setMessage("Stopping the managed runtime…");
    try {
      await runtimeBridge.stop();
      state.setProviderHealth(null);
      setAction("success");
      setMessage("Managed runtime stopped.");
    } catch (error) {
      setAction("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <section className="settings-surface models-screen">
      <header className="surface-heading">
        <div>
          <h1>Intelligence</h1>
          <p>Connect ChatGPT through the official Codex runtime, or use llama.cpp locally.</p>
        </div>
        <div className="provider-badge">
          <span className={state.codexAccount?.state === "connected" ? "status-light is-ready" : "status-light"} />
          {state.codexAccount?.state === "connected" ? "ChatGPT connected" : "Codex"}
        </div>
      </header>

      <div className="settings-column">
        <section className="settings-section account-section">
          <div className="section-title">
            <h2>ChatGPT account</h2>
            <p>Official account authentication, managed by the installed Codex runtime.</p>
          </div>
          {state.codexAccount?.state === "connected" ? (
            <div className="account-row">
              <div><strong>{state.codexAccount.email ?? "Connected account"}</strong><span>{state.codexAccount.planType ? `ChatGPT ${state.codexAccount.planType}` : "Ready"}</span></div>
              <button className="secondary-button" type="button" onClick={() => void disconnectCodex()}><LogOut size={14} /> Disconnect</button>
            </div>
          ) : (
            <div className="button-row">
              <button className="primary-button" type="button" onClick={() => void connectCodex("browser")}><LogIn size={15} /> Continue with ChatGPT</button>
              <button className="secondary-button" type="button" onClick={() => void connectCodex("deviceCode")}>Use device code</button>
            </div>
          )}
          {loginCode && <div className="device-code"><span>One-time code</span><strong>{loginCode}</strong></div>}
          {loginId && state.codexAccount?.state !== "connected" && <button className="text-button" type="button" onClick={() => void cancelLogin()}>Cancel sign-in</button>}
          {state.codexStatus?.version && <p className="runtime-detail">Codex {state.codexStatus.version}</p>}
        </section>

        <section className="settings-section">
          <div className="section-title">
            <h2>Local runtime</h2>
            <p>llama.cpp-compatible, loopback only</p>
          </div>
          <div className="segmented-control" aria-label="Runtime mode">
            <button
              type="button"
              className={state.runtime.mode === "external" ? "is-active" : ""}
              onClick={() => state.updateRuntime({ mode: "external" })}
            >
              Running server
            </button>
            <button
              type="button"
              className={state.runtime.mode === "managed" ? "is-active" : ""}
              onClick={() => state.updateRuntime({ mode: "managed" })}
            >
              Managed locally
            </button>
          </div>

          {state.runtime.mode === "external" ? (
            <div className="field-stack">
              <label className="field">
                <span>Local endpoint</span>
                <input
                  value={state.runtime.endpoint}
                  onChange={(event) => state.updateRuntime({ endpoint: event.target.value })}
                  spellCheck={false}
                />
                <small>Only localhost, 127.0.0.1, or ::1 over HTTP is accepted.</small>
              </label>
              <button className="primary-button" type="button" onClick={() => void checkRuntime()}>
                Check local runtime
              </button>
            </div>
          ) : (
            <div className="field-stack">
              <label className="field">
                <span>llama-server executable</span>
                <div className="path-field">
                  <input
                    value={state.runtime.executablePath}
                    onChange={(event) => state.updateRuntime({ executablePath: event.target.value })}
                    placeholder="Select llama-server.exe"
                    spellCheck={false}
                  />
                  <button type="button" onClick={() => void choosePath("runtime")} aria-label="Select llama-server executable">
                    <FolderOpen size={16} />
                  </button>
                </div>
              </label>
              <label className="field">
                <span>GGUF model</span>
                <div className="path-field">
                  <input
                    value={state.runtime.modelPath}
                    onChange={(event) => state.updateRuntime({ modelPath: event.target.value })}
                    placeholder="Select a .gguf file"
                    spellCheck={false}
                  />
                  <button type="button" onClick={() => void choosePath("model")} aria-label="Select GGUF model">
                    <FolderOpen size={16} />
                  </button>
                </div>
              </label>
              <div className="field-grid">
                <label className="field">
                  <span>Port</span>
                  <input
                    type="number"
                    min={1024}
                    max={65535}
                    value={state.runtime.port}
                    onChange={(event) => state.updateRuntime({ port: event.target.valueAsNumber })}
                  />
                </label>
                <label className="field">
                  <span>Context</span>
                  <input
                    type="number"
                    min={256}
                    value={state.runtime.context}
                    onChange={(event) => state.updateRuntime({ context: event.target.valueAsNumber })}
                  />
                </label>
                <label className="field">
                  <span>GPU layers</span>
                  <input
                    type="number"
                    min={-1}
                    max={999}
                    value={state.runtime.gpuLayers}
                    onChange={(event) => state.updateRuntime({ gpuLayers: event.target.valueAsNumber })}
                  />
                </label>
              </div>
              <div className="button-row">
                <button
                  className="primary-button"
                  type="button"
                  disabled={!state.runtime.executablePath || !state.runtime.modelPath}
                  onClick={() => void startManaged()}
                >
                  <Play size={15} /> Start local runtime
                </button>
                <button className="secondary-button" type="button" onClick={() => void stopManaged()}>
                  <Square size={13} /> Stop runtime
                </button>
              </div>
            </div>
          )}

          {message && (
            <div className={`status-message is-${action}`} role={action === "error" ? "alert" : "status"}>
              {action === "working" && <LoaderCircle className="spin" size={16} />}
              {action === "success" && <CheckCircle2 size={16} />}
              {action === "error" && <CircleAlert size={16} />}
              <span>{message}</span>
            </div>
          )}
        </section>

        <section className="settings-section">
          <div className="section-title">
            <h2>Available models</h2>
            <p>Models are discovered from the connected runtime.</p>
          </div>
          {state.models.length ? (
            <div className="model-list">
              {state.models.map((model) => (
                <button
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
                    <small>{model.providerId === "openai-codex" ? "OpenAI Codex" : model.format || "llama.cpp"} · {model.location}</small>
                  </span>
                  <span>{state.selectedModelId === model.id ? "Active" : "Use model"}</span>
                </button>
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
            A discovered model is labeled as an imported baseline only. VOID Mind does not claim an A1 model exists without a verified trained artifact and manifest.
          </p>
        </section>
      </div>
    </section>
  );
}
