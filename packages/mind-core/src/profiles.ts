import type { GenerationSettings, Profile, ProfileId } from "./types";

export const DEFAULT_SYSTEM_INSTRUCTIONS = [
  "You are VOID Mind, a general-purpose local conversational AI.",
  "Be clear, useful, and honest about uncertainty across conversation, reasoning, writing, study, brainstorming, and explanation.",
  "Reply in Brazilian Portuguese when the user writes in Portuguese, while retaining strong English support.",
  "You have no autonomous tools, shell access, repository access, telemetry, or cloud inference."
].join(" ");

export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
  systemInstructions: DEFAULT_SYSTEM_INSTRUCTIONS,
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  repeatPenalty: 1.1,
  maxTokens: 1024,
  context: 4096,
  seed: -1,
  stopSequences: []
};

const overrides: Record<Exclude<ProfileId, "custom">, Partial<GenerationSettings>> = {
  general: {},
  creative: { temperature: 1, topP: 0.95, topK: 60, repeatPenalty: 1.05, maxTokens: 1536 },
  analytical: { temperature: 0.35, topP: 0.85, topK: 30, repeatPenalty: 1.12, maxTokens: 1400 },
  concise: { temperature: 0.25, topP: 0.8, topK: 24, repeatPenalty: 1.12, maxTokens: 512 }
};

const descriptions: Record<Exclude<ProfileId, "custom">, string> = {
  general: "Balanced default behavior",
  creative: "More exploratory writing and variation",
  analytical: "More structured, deliberate explanation",
  concise: "Reduced verbosity and direct answers"
};

export const DEFAULT_PROFILES: Profile[] = (
  ["general", "creative", "analytical", "concise"] as const
).map((id) => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  description: descriptions[id],
  settings: { ...DEFAULT_GENERATION_SETTINGS, ...overrides[id] }
}));

export const DEFAULT_CUSTOM_PROFILE: Profile = {
  id: "custom",
  name: "Custom",
  description: "User-defined generation behavior",
  settings: { ...DEFAULT_GENERATION_SETTINGS }
};

export function resolveProfile(
  profiles: Profile[],
  customProfile: Profile,
  id: ProfileId
): Profile {
  return id === "custom"
    ? customProfile
    : profiles.find((profile) => profile.id === id) ?? DEFAULT_PROFILES[0];
}
