import type { MindState } from "@void-mind/mind-core";

/** Existing bindings may need the optional runtime; fresh direct login does not. */
export function needsLegacyCodex(state: Pick<MindState, "defaultPreference" | "conversations" | "workspaces">): boolean {
  return state.defaultPreference.providerId === "openai-codex"
    || state.conversations.some((conversation) => conversation.providerBinding?.providerId === "openai-codex" || conversation.providerOverride?.providerId === "openai-codex")
    || state.workspaces.some((workspace) => workspace.preference?.providerId === "openai-codex");
}
