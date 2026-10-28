import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { normalizeOpenAIModels, type ConnectionStatus, type ConnectionStreamEvent, type OpenAIBridge, type OpenAIProviderId } from "@void-mind/providers";
import { useMindStore } from "../stores/mind-store";

export const connectionsBridge: OpenAIBridge = {
  status: () => invoke("connections_status"),
  models: (provider) => invoke("connection_models", { provider }),
  generate: (requestId, request) => invoke("connection_generate", { requestId, request }),
  cancel: (requestId) => invoke("connection_cancel", { requestId }),
  subscribe: (listener) => listen<ConnectionStreamEvent>("void-mind://connection-stream", ({ payload }) => listener(payload))
};
export async function refreshConnections(): Promise<ConnectionStatus> {
  const status = await connectionsBridge.status();
  useMindStore.getState().setConnections(status);
  const results = await Promise.allSettled((["openai-chatgpt", "openai-api"] as const).map(async (provider) => {
    const enabled = provider === "openai-api" ? status.apiConnected : status.accounts.some((a) => a.id === status.activeAccountId && a.connected && a.planAuthorized);
    // Drop the prior account's catalog before discovering its replacement.
    useMindStore.getState().setProviderModels(provider, []);
    const models = enabled ? normalizeOpenAIModels(await connectionsBridge.models(provider), provider) : [];
    const current = useMindStore.getState(); current.setProviderModels(provider, models);
    if (models.length && current.defaultPreference.providerId === provider && !current.defaultPreference.modelId) current.setDefaultPreference({ providerId: provider, modelId: models[0].id });
  }));
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
  return status;
}
export const beginChatGPTLogin = (accountId?: string) => invoke<string>("connection_login", { accountId: accountId ?? null });
export const chatGPTLoginProgress = () => invoke<{ loginId: string; state: "pending" | "success" | "error"; message: string } | null>("connection_login_progress");
export const cancelChatGPTLogin = (loginId: string) => invoke<void>("connection_login_cancel", { loginId });
export const saveAPIKey = (key: string) => invoke<void>("connection_api_save", { key });
export const disconnectConnection = (provider: OpenAIProviderId) => invoke<string | null>("connection_disconnect", { provider });
export const selectChatGPTAccount = (accountId: string) => invoke<void>("connection_select", { accountId });
export const welcomeSeen = () => invoke<void>("connection_welcome_seen");
export const openUsage = () => invoke<void>("connection_usage");
