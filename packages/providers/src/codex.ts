import type { ModelDescriptor, ProviderCapabilities } from "@void-mind/mind-core";
import type {
  GenerationRequest,
  MindProvider,
  ProviderEvent,
  ProviderHealth
} from "./types";

export type CodexRuntimeStatus = {
  installed: boolean;
  running: boolean;
  state: "notInstalled" | "ready" | "running" | "error";
  executablePath?: string;
  version?: string;
  neutralWorkspace?: string;
  exitCode?: number;
  error?: string;
};

export type CodexAccountState = {
  state: "connected" | "disconnected" | "unsupported";
  authMode?: string;
  email?: string;
  planType?: string;
};

export type CodexLoginStart = {
  flow: "browser" | "deviceCode";
  loginId: string;
  authUrl?: string;
  verificationUrl?: string;
  userCode?: string;
};

export type CodexProtocolModel = {
  id: string;
  displayName: string;
  description: string;
  isDefault: boolean;
  reasoningEfforts: Array<{ id: string; description: string }>;
  defaultReasoningEffort?: string;
  inputModalities: string[];
  supportsPersonality: boolean;
  serviceTiers: Array<{ id: string; name: string; description: string }>;
  defaultServiceTier?: string;
};

export type CodexRuntimeEvent =
  | { type: "loginCompleted"; loginId?: string; success: boolean; error?: string }
  | { type: "accountUpdated"; authMode?: string; planType?: string }
  | {
      type: "assistantDelta";
      threadId: string;
      turnId: string;
      itemId: string;
      delta: string;
    }
  | {
      type: "turnCompleted";
      threadId: string;
      turnId: string;
      status: string;
      error?: string;
    }
  | {
      type: "error" | "protocolError" | "runtimeExited";
      threadId?: string;
      turnId?: string;
      category: string;
      message: string;
      willRetry?: boolean;
    }
  | { type: "modelRerouted"; fromModel?: string; toModel?: string; reason?: string }
  | { type: "usageUpdated" };

export type CodexBridge = {
  status(): Promise<CodexRuntimeStatus>;
  start(): Promise<CodexRuntimeStatus>;
  stop(): Promise<CodexRuntimeStatus>;
  account(): Promise<CodexAccountState>;
  beginLogin(flow: "browser" | "deviceCode"): Promise<CodexLoginStart>;
  cancelLogin(loginId: string): Promise<void>;
  logout(): Promise<void>;
  openAuthUrl(url: string): Promise<void>;
  models(): Promise<CodexProtocolModel[]>;
  startThread(request: {
    model: string;
    contextInstructions?: string;
  }): Promise<{ remoteThreadId: string }>;
  resumeThread(request: {
    remoteThreadId: string;
    model: string;
    contextInstructions?: string;
  }): Promise<{ remoteThreadId: string }>;
  startTurn(request: {
    remoteThreadId: string;
    message: string;
    model: string;
    reasoningEffort?: string;
    serviceTier?: string;
  }): Promise<{ turnId: string }>;
  interrupt(request: { remoteThreadId: string; turnId: string }): Promise<void>;
  subscribe(listener: (event: CodexRuntimeEvent) => void): Promise<() => void>;
};

export const CODEX_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  cancellation: true,
  files: false,
  vision: true,
  images: true,
  audio: false,
  tools: false,
  reasoning: true,
  local: false,
  remote: true,
  accountAuth: true,
  threadPersistence: true
};

export function normalizeCodexModels(models: CodexProtocolModel[]): ModelDescriptor[] {
  return models.map((model) => ({
    id: `openai-codex:${model.id}`,
    displayName: model.displayName,
    identifier: model.id,
    version: "Codex runtime",
    providerId: "openai-codex",
    location: "remote",
    languages: [],
    capabilities: [
      "conversation",
      "streaming",
      ...(model.inputModalities.includes("image") ? ["image-input"] : []),
      ...(model.reasoningEfforts.length > 1 ? ["reasoning"] : [])
    ],
    description: model.description,
    isDefault: model.isDefault,
    reasoningEfforts: model.reasoningEfforts,
    defaultReasoningEffort: model.defaultReasoningEffort,
    inputModalities: model.inputModalities,
    supportsPersonality: model.supportsPersonality,
    serviceTiers: model.serviceTiers,
    defaultServiceTier: model.defaultServiceTier
  }));
}

class EventQueue {
  private values: CodexRuntimeEvent[] = [];
  private listeners: Array<(value: CodexRuntimeEvent) => void> = [];

  push(value: CodexRuntimeEvent) {
    const listener = this.listeners.shift();
    if (listener) listener(value);
    else this.values.push(value);
  }

  next(signal?: AbortSignal): Promise<CodexRuntimeEvent> {
    if (signal?.aborted) return Promise.reject(abortReason(signal));
    const value = this.values.shift();
    if (value) return Promise.resolve(value);
    return new Promise((resolve, reject) => {
      const onValue = (event: CodexRuntimeEvent) => {
        signal?.removeEventListener("abort", onAbort);
        resolve(event);
      };
      const onAbort = () => {
        const index = this.listeners.indexOf(onValue);
        if (index >= 0) this.listeners.splice(index, 1);
        reject(abortReason(signal));
      };
      this.listeners.push(onValue);
      signal?.addEventListener("abort", onAbort, { once: true });
      if (signal?.aborted) onAbort();
    });
  }
}

function abortReason(signal?: AbortSignal): unknown {
  return signal?.reason ?? new DOMException("Generation stopped.", "AbortError");
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortReason(signal);
}

export class CodexProvider implements MindProvider {
  readonly id = "openai-codex";
  readonly displayName = "OpenAI Codex";
  readonly capabilities = CODEX_PROVIDER_CAPABILITIES;
  private activeTurn: { remoteThreadId: string; turnId: string } | null = null;

  constructor(private readonly bridge: CodexBridge) {}

  async health(): Promise<ProviderHealth> {
    const runtime = await this.bridge.start();
    if (!runtime.installed) {
      return { ok: false, state: "offline", detail: "Codex is not installed." };
    }
    const account = await this.bridge.account();
    if (account.state !== "connected") {
      return {
        ok: false,
        state: "offline",
        detail: "Connect a ChatGPT account through Codex."
      };
    }
    return {
      ok: true,
      state: "ready",
      detail: account.planType ? `ChatGPT ${account.planType}` : "ChatGPT account"
    };
  }

  async models(): Promise<ModelDescriptor[]> {
    return normalizeCodexModels(await this.bridge.models());
  }

  cancel(): void {
    if (this.activeTurn) void this.bridge.interrupt(this.activeTurn).catch(() => undefined);
  }

  async *generate(
    request: GenerationRequest,
    signal?: AbortSignal
  ): AsyncGenerator<ProviderEvent> {
    const queue = new EventQueue();
    const unsubscribe = await this.bridge.subscribe((event) => queue.push(event));
    let abort: (() => void) | undefined;

    try {
      throwIfAborted(signal);
      const binding = request.remoteThreadId
        ? await this.bridge.resumeThread({
            remoteThreadId: request.remoteThreadId,
            model: request.model.identifier,
            contextInstructions: request.contextInstructions
          })
        : await this.bridge.startThread({
            model: request.model.identifier,
            contextInstructions: request.contextInstructions
          });
      throwIfAborted(signal);
      if (!request.remoteThreadId) {
        yield { type: "binding", remoteThreadId: binding.remoteThreadId };
      }
      const message = [...request.messages].reverse().find((item) => item.role === "user");
      if (!message) throw new Error("A user message is required.");
      const turn = await this.bridge.startTurn({
        remoteThreadId: binding.remoteThreadId,
        message: message.content,
        model: request.model.identifier,
        reasoningEffort: request.reasoningEffort,
        serviceTier: request.serviceTier
      });
      throwIfAborted(signal);
      this.activeTurn = { remoteThreadId: binding.remoteThreadId, turnId: turn.turnId };
      abort = () => this.cancel();
      signal?.addEventListener("abort", abort, { once: true });
      yield { type: "start", turnId: turn.turnId };

      while (true) {
        const event = await queue.next(signal);
        if (
          "threadId" in event &&
          event.threadId &&
          event.threadId !== binding.remoteThreadId
        ) continue;
        if ("turnId" in event && event.turnId && event.turnId !== turn.turnId) continue;
        if (event.type === "assistantDelta") {
          yield { type: "token", content: event.delta };
        } else if (event.type === "turnCompleted") {
          if (event.status === "failed") {
            yield {
              type: "error",
              message: event.error || "Codex could not complete this response.",
              recoverable: true
            };
          } else {
            yield { type: "done", finishReason: event.status };
          }
          return;
        } else if (
          event.type === "error" ||
          event.type === "protocolError" ||
          event.type === "runtimeExited"
        ) {
          if (!event.willRetry) {
            yield { type: "error", message: event.message, recoverable: true };
            return;
          }
        }
      }
    } finally {
      if (abort) signal?.removeEventListener("abort", abort);
      unsubscribe();
      this.activeTurn = null;
    }
  }
}
