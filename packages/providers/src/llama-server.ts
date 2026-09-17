import type { ModelDescriptor, ProviderCapabilities } from "@void-mind/mind-core";
import type {
  GenerationRequest,
  MindProvider,
  ProviderEvent,
  ProviderHealth
} from "./types";
import { effectiveSystemInstructions } from "./types";

type FetchLike = typeof fetch;

export const LOCAL_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  cancellation: true,
  local: true,
  files: false,
  vision: false,
  tools: false,
  reasoning: false,
  accountAuth: false
};

export function normalizeLoopbackEndpoint(value: string): string {
  const candidate = value.trim().replace(/\/+$/, "");
  const url = new URL(candidate);
  if (url.protocol !== "http:") throw new Error("The local runtime must use HTTP.");
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("The local runtime must use a loopback address.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("The local runtime address cannot contain credentials or parameters.");
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    throw new Error("Use the llama-server origin without an API path.");
  }
  return url.origin;
}

export class SseDecoder {
  private buffer = "";

  push(chunk: string): string[] {
    this.buffer += chunk.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const events: string[] = [];
    let boundary = this.buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const block = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (data) events.push(data);
      boundary = this.buffer.indexOf("\n\n");
    }
    return events;
  }

  flush(): string[] {
    return this.buffer.trim() ? this.push("\n\n") : [];
  }
}

export function parseLlamaEvent(data: string): ProviderEvent {
  if (data.trim() === "[DONE]") return { type: "done" };
  try {
    const payload = JSON.parse(data) as {
      error?: { message?: string };
      choices?: Array<{
        delta?: { content?: string };
        finish_reason?: string | null;
      }>;
    };
    if (payload.error) {
      return {
        type: "error",
        message: payload.error.message || "The local runtime reported an error.",
        recoverable: true
      };
    }
    const choice = payload.choices?.[0];
    if (choice?.delta?.content) return { type: "token", content: choice.delta.content };
    if (choice?.finish_reason) return { type: "done", finishReason: choice.finish_reason };
    return { type: "token", content: "" };
  } catch {
    return {
      type: "error",
      message: "The local runtime returned an invalid stream event.",
      recoverable: true
    };
  }
}

function timedSignal(external?: AbortSignal, duration = 5_000) {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(external?.reason);
  if (external?.aborted) forwardAbort();
  else external?.addEventListener("abort", forwardAbort, { once: true });
  const timer = globalThis.setTimeout(
    () => controller.abort(new DOMException("The runtime check timed out.", "TimeoutError")),
    duration
  );
  return {
    signal: controller.signal,
    cleanup: () => {
      globalThis.clearTimeout(timer);
      external?.removeEventListener("abort", forwardAbort);
    }
  };
}

export class LlamaServerProvider implements MindProvider {
  readonly id = "void-local";
  readonly displayName = "VOID Local";
  readonly capabilities = LOCAL_PROVIDER_CAPABILITIES;
  readonly endpoint: string;
  private readonly fetcher: FetchLike;
  private activeController: AbortController | null = null;

  constructor(endpoint: string, fetcher?: FetchLike) {
    this.endpoint = normalizeLoopbackEndpoint(endpoint);
    this.fetcher = fetcher ?? globalThis.fetch.bind(globalThis);
  }

  async health(signal?: AbortSignal): Promise<ProviderHealth> {
    const timed = timedSignal(signal);
    try {
      const response = await this.fetcher(`${this.endpoint}/health`, { signal: timed.signal });
      if (response.status === 503) {
        return { ok: false, state: "loading", detail: "The selected model is loading." };
      }
      if (!response.ok) {
        return { ok: false, state: "offline", detail: `Runtime returned HTTP ${response.status}.` };
      }
      const models = await this.models(timed.signal);
      return { ok: true, state: "ready", modelIdentifier: models[0]?.identifier };
    } catch (error) {
      return {
        ok: false,
        state: signal?.aborted ? "offline" : "error",
        detail: error instanceof Error ? error.message : "The local runtime is unavailable."
      };
    } finally {
      timed.cleanup();
    }
  }

  async models(signal?: AbortSignal): Promise<ModelDescriptor[]> {
    const response = await this.fetcher(`${this.endpoint}/v1/models`, { signal });
    if (!response.ok) throw new Error(`Model discovery returned HTTP ${response.status}.`);
    const payload = (await response.json()) as { data?: Array<{ id?: string }> };
    return (payload.data ?? [])
      .filter((entry): entry is { id: string } => Boolean(entry.id))
      .map((entry) => ({
        id: `void-local:${entry.id}`,
        displayName: entry.id,
        identifier: entry.id,
        version: "A0",
        providerId: this.id,
        location: "local",
        format: "GGUF",
        languages: [],
        capabilities: ["conversation", "streaming"]
      }));
  }

  cancel(): void {
    this.activeController?.abort(new DOMException("Generation stopped.", "AbortError"));
  }

  async *generate(
    request: GenerationRequest,
    signal?: AbortSignal
  ): AsyncGenerator<ProviderEvent> {
    const controller = new AbortController();
    this.activeController = controller;
    const forwardAbort = () => controller.abort(signal?.reason);
    if (signal?.aborted) forwardAbort();
    else signal?.addEventListener("abort", forwardAbort, { once: true });
    try {
      const response = await this.fetcher(`${this.endpoint}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: request.model.identifier,
          messages: [
            { role: "system", content: effectiveSystemInstructions(request) },
            ...request.messages.map(({ role, content }) => ({ role, content }))
          ],
          stream: true,
          temperature: request.settings.temperature,
          top_p: request.settings.topP,
          top_k: request.settings.topK,
          repeat_penalty: request.settings.repeatPenalty,
          max_tokens: request.settings.maxTokens,
          seed: request.settings.seed,
          stop: request.settings.stopSequences.length
            ? request.settings.stopSequences
            : undefined
        }),
        signal: controller.signal
      });
      if (!response.ok) {
        const detail = (await response.text()).trim();
        throw new Error(detail || `Generation returned HTTP ${response.status}.`);
      }
      if (!response.body) throw new Error("The local runtime returned no response stream.");

      yield { type: "start" };
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const sse = new SseDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const event of sse.push(decoder.decode(value, { stream: true }))) {
            const parsed = parseLlamaEvent(event);
            yield parsed;
            if (parsed.type === "done" || parsed.type === "error") return;
          }
        }
        for (const event of sse.flush()) yield parseLlamaEvent(event);
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
    } finally {
      signal?.removeEventListener("abort", forwardAbort);
      if (this.activeController === controller) this.activeController = null;
    }
  }
}
