import type { ModelDescriptor } from "@void-mind/mind-core";
import type {
  CodexAccountState,
  CodexRuntimeStatus,
  ProviderHealth
} from "@void-mind/providers";

type ProviderAvailabilityState = {
  models: ModelDescriptor[];
  codexStatus: CodexRuntimeStatus | null;
  codexAccount: CodexAccountState | null;
  providerHealth: ProviderHealth | null;
};

export function availableProviderIds(state: ProviderAvailabilityState): string[] {
  const providers = new Set<string>();
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
