import type {
  GenerationSettings,
  MindMessage,
  ModelDescriptor,
  ProviderCapabilities
} from "@void-mind/mind-core";

export type ProviderHealth = {
  ok: boolean;
  state: "ready" | "loading" | "offline" | "error";
  detail?: string;
  modelIdentifier?: string;
};

export type GenerationRequest = {
  conversationId: string;
  messages: MindMessage[];
  model: ModelDescriptor;
  settings: GenerationSettings;
  remoteThreadId?: string;
  contextInstructions?: string;
  reasoningEffort?: string;
  serviceTier?: string;
};

export type ProviderEvent =
  | { type: "binding"; remoteThreadId: string }
  | { type: "start"; turnId?: string }
  | { type: "token"; content: string }
  | { type: "done"; finishReason?: string }
  | { type: "error"; message: string; recoverable: boolean };

export interface MindProvider {
  readonly id: string;
  readonly displayName: string;
  readonly capabilities: ProviderCapabilities;
  health(signal?: AbortSignal): Promise<ProviderHealth>;
  models(signal?: AbortSignal): Promise<ModelDescriptor[]>;
  generate(request: GenerationRequest, signal?: AbortSignal): AsyncGenerator<ProviderEvent>;
  cancel(): void;
}
