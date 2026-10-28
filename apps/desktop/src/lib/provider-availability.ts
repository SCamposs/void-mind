import type { ModelDescriptor } from "@void-mind/mind-core";
import type {
  CodexAccountState,
  CodexRuntimeStatus,
  ProviderHealth
} from "@void-mind/providers";
import { connectionAvailable, type ConnectionStatus } from "@void-mind/providers";

type ProviderAvailabilityState = {
  models: ModelDescriptor[];
  codexStatus: CodexRuntimeStatus | null;
  codexAccount: CodexAccountState | null;
  providerHealth: ProviderHealth | null;
  connections?: ConnectionStatus | null;
};

export function availableProviderIds(state: ProviderAvailabilityState): string[] {
  const providers = new Set<string>();
  for (const provider of ["openai-chatgpt", "openai-api"] as const) {
    if (connectionAvailable(state.connections, provider) && state.models.some((m) => m.providerId === provider)) providers.add(provider);
  }
  const hasCodexModel = state.models.some((model) => model.providerId === "openai-codex");
  const hasLocalModel = state.models.some((model) => model.providerId === "void-local");

  if (state.codexStatus?.running && state.codexAccount?.state === "connected" && hasCodexModel) {
    providers.add("openai-codex");
  }
  if (state.providerHealth?.ok && hasLocalModel) {
    providers.add("void-local");
  }

  return [...providers];
}
