import type { ModelDescriptor, ProviderCapabilities } from "@void-mind/mind-core";
import { effectiveSystemInstructions, type GenerationRequest, type MindProvider, type ProviderEvent, type ProviderHealth } from "./types";

export type OpenAIProviderId = "openai-chatgpt" | "openai-api";
export type ConnectionStatus = {
  accounts: Array<{ id: string; email?: string; connected: boolean; planAuthorized: boolean }>;
  activeAccountId?: string;
  apiConnected: boolean;
  welcomePending: boolean;
};
export type RemoteModel = { id: string; displayName: string };
export type ConnectionStreamEvent = ProviderEvent & { requestId: string };
export type OpenAIBridge = {
  models(provider: OpenAIProviderId): Promise<RemoteModel[]>;
  status(): Promise<ConnectionStatus>;
  generate(requestId: string, request: { provider: OpenAIProviderId; model: string; messages: Array<{ role: string; content: string }>; instructions: string }): Promise<void>;
  cancel(requestId: string): Promise<void>;
  subscribe(listener: (event: ConnectionStreamEvent) => void): Promise<() => void>;
};
export function normalizeOpenAIModels(models: RemoteModel[], providerId: OpenAIProviderId): ModelDescriptor[] {
  return models.map((model, index) => ({ id: `${providerId}:${model.id}`, identifier: model.id, displayName: model.displayName,
    version: providerId === "openai-chatgpt" ? "ChatGPT plan" : "OpenAI API", providerId, location: "remote", languages: [],
    capabilities: ["conversation", "streaming"], isDefault: index === 0 }));
}
export function connectionAvailable(status: ConnectionStatus | null | undefined, provider: OpenAIProviderId): boolean {
  return provider === "openai-api" ? Boolean(status?.apiConnected)
    : Boolean(status?.accounts.some((a) => a.id === status.activeAccountId && a.connected && a.planAuthorized));
}
export class OpenAIProvider implements MindProvider {
  readonly displayName: string;
  readonly capabilities: ProviderCapabilities = { streaming: true, cancellation: true, remote: true, tools: false, accountAuth: true };
  private active: string | null = null;
  constructor(readonly id: OpenAIProviderId, private bridge: OpenAIBridge) { this.displayName = id === "openai-chatgpt" ? "ChatGPT" : "OpenAI API"; }
  async health(): Promise<ProviderHealth> { const ok = connectionAvailable(await this.bridge.status(), this.id); return { ok, state: ok ? "ready" : "offline" }; }
  async models() { return normalizeOpenAIModels(await this.bridge.models(this.id), this.id); }
  async *generate(request: GenerationRequest, signal?: AbortSignal): AsyncGenerator<ProviderEvent> {
    if (signal?.aborted) throw signal.reason ?? new DOMException("Generation stopped.", "AbortError");
    const id = crypto.randomUUID(); this.active = id;
    const queue: ProviderEvent[] = []; let wake: (() => void) | undefined; let settled = false; let failure: unknown;
    const unsubscribe = await this.bridge.subscribe((event) => { if (event.requestId === id) { queue.push(event); wake?.(); } });
    const abort = () => { void this.bridge.cancel(id).catch(() => undefined); wake?.(); };
    signal?.addEventListener("abort", abort, { once: true });
    try {
      if (signal?.aborted) throw signal.reason ?? new DOMException("Generation stopped.", "AbortError");
      const task = this.bridge.generate(id, { provider: this.id, model: request.model.identifier,
        messages: request.messages.map(({ role, content }) => ({ role, content })), instructions: effectiveSystemInstructions(request) })
        .catch((error: unknown) => { failure = error; }).finally(() => { settled = true; wake?.(); });
      while (true) {
        // Wait for native cancellation acknowledgement before another generation.
        if (signal?.aborted) { await task; throw signal.reason ?? new DOMException("Generation stopped.", "AbortError"); }
        const event = queue.shift();
        if (event) { yield event; if (event.type === "done") { await task; if (failure) throw failure; return; } continue; }
        if (settled) { if (failure) throw failure; throw new Error("OpenAI did not confirm response completion."); }
        await new Promise<void>((resolve) => { wake = resolve; }); wake = undefined;
      }
    } finally { signal?.removeEventListener("abort", abort); unsubscribe(); this.active = null; }
  }
  cancel() { if (this.active) void this.bridge.cancel(this.active).catch(() => undefined); }
}
