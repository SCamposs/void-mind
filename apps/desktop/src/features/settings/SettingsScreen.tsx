import type { GenerationSettings, ProfileId } from "@void-mind/mind-core";
import { activeSettings, useMindStore } from "../../stores/mind-store";

const numericFields: Array<{
  key: keyof Pick<
    GenerationSettings,
    "temperature" | "topP" | "topK" | "repeatPenalty" | "maxTokens" | "context" | "seed"
  >;
  label: string;
  min?: number;
  max?: number;
  step?: number;
}> = [
  { key: "temperature", label: "Temperature", min: 0, max: 2, step: 0.05 },
  { key: "topP", label: "Top-p", min: 0.01, max: 1, step: 0.01 },
  { key: "topK", label: "Top-k", min: 0, step: 1 },
  { key: "repeatPenalty", label: "Repeat penalty", min: 0.5, max: 2, step: 0.01 },
  { key: "maxTokens", label: "Maximum tokens", min: 1, step: 1 },
  { key: "context", label: "Context", min: 256, step: 256 },
  { key: "seed", label: "Seed", min: -1, step: 1 }
];

export function SettingsScreen() {
  const state = useMindStore();
  const settings = activeSettings(state);
  const profiles = [...state.profiles, state.customProfile];

  return (
    <section className="settings-surface">
      <header className="surface-heading">
        <div>
          <h1>Settings</h1>
          <p>Choose how Mind responds and what is retained locally.</p>
        </div>
      </header>
      <div className="settings-column">
        <section className="settings-section">
          <div className="section-title">
            <h2>Response profile</h2>
            <p>Human-readable behavior, without crowding the conversation.</p>
          </div>
          <div className="profile-list">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                className={state.selectedProfileId === profile.id ? "is-active" : ""}
                onClick={() => state.selectProfile(profile.id as ProfileId)}
              >
                <strong>{profile.name}</strong>
                <span>{profile.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <details>
            <summary>
              <span>
                <strong>Advanced generation</strong>
                <small>Technical controls for the Custom profile</small>
              </span>
            </summary>
            <div className="advanced-settings">
              <label className="field field-wide">
                <span>System instructions</span>
                <textarea
                  rows={5}
                  value={settings.systemInstructions}
                  onChange={(event) =>
                    state.updateCustomSettings({ systemInstructions: event.target.value })
                  }
                />
              </label>
              <div className="field-grid">
                {numericFields.map((field) => (
                  <label className="field" key={field.key}>
                    <span>{field.label}</span>
                    <input
                      type="number"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={settings[field.key]}
                      onChange={(event) =>
                        state.updateCustomSettings({ [field.key]: event.target.valueAsNumber })
                      }
                    />
                  </label>
                ))}
              </div>
              <label className="field field-wide">
                <span>Stop sequences</span>
                <input
                  value={settings.stopSequences.join(", ")}
                  onChange={(event) =>
                    state.updateCustomSettings({
                      stopSequences: event.target.value
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean)
                    })
                  }
                  placeholder="Comma-separated"
                />
              </label>
            </div>
          </details>
        </section>

        <section className="settings-section">
          <div className="section-title">
            <h2>Local behavior</h2>
            <p>These preferences contain no credentials.</p>
          </div>
          <div className="toggle-list">
            <label>
              <span>
                <strong>Show boot intro</strong>
                <small>Display the VOID Mind identity when the app opens.</small>
              </span>
              <input
                type="checkbox"
                checked={state.preferences.showBootIntro}
                onChange={(event) =>
                  state.updatePreferences({ showBootIntro: event.target.checked })
                }
              />
            </label>
            <label>
              <span>
                <strong>Retain conversations</strong>
                <small>Store conversations in this app's local storage.</small>
              </span>
              <input
                type="checkbox"
                checked={state.preferences.retainConversations}
                onChange={(event) =>
                  state.updatePreferences({ retainConversations: event.target.checked })
                }
              />
            </label>
          </div>
          {!state.storageHealthy && (
            <p className="inline-error" role="alert">
              Local storage is unavailable. New changes may not survive an app restart.
            </p>
          )}
        </section>

        <section className="settings-section privacy-section">
          <div className="section-title">
            <h2>Privacy boundary</h2>
          </div>
          <p>
            {state.selectedProviderId === "openai-codex"
              ? "When ChatGPT is active, your prompt, workspace instructions, and only the knowledge sources selected for that conversation are sent through the official Codex runtime. Account credentials remain runtime-managed."
              : "With VOID Local, prompts and model execution remain on this device through the configured loopback runtime."}
          </p>
        </section>
      </div>
    </section>
  );
}
