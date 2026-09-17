import {
  DEFAULT_CUSTOM_PROFILE,
  DEFAULT_PROFILES,
  type Conversation,
  type GenerationSettings,
  type KnowledgeItem,
  type LocalRuntimeConfig,
  type MindState,
  type ModelDescriptor,
  type Profile,
  type ProfileId,
  type ProviderPreference,
  type UserPreferences,
  type Workspace
} from "@void-mind/mind-core";

export const MIND_STORAGE_KEY = "void-mind:state";
export const MIND_STORAGE_VERSION = 5;

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const DEFAULT_MIND_STATE: MindState = {
  conversations: [],
  selectedConversationId: null,
  workspaces: [],
  selectedWorkspaceId: null,
  knowledge: [],
  profiles: structuredClone(DEFAULT_PROFILES),
  selectedProfileId: "general",
  customProfile: structuredClone(DEFAULT_CUSTOM_PROFILE),
  models: [],
  selectedModelId: null,
  selectedProviderId: "openai-codex",
  defaultPreference: {
    providerId: "openai-codex"
  },
  runtime: {
    mode: "external",
    endpoint: "http://127.0.0.1:8080",
    executablePath: "",
    modelPath: "",
    port: 8080,
    context: 4096,
    gpuLayers: 0
  },
  preferences: {
    onboardingComplete: false,
    showBootIntro: true,
    retainConversations: true
  }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function conversations(value: unknown): Conversation[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is Record<string, unknown> =>
        isRecord(item) &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        Array.isArray(item.messages)
    )
    .map((item) => ({
      id: item.id as string,
      title: item.title as string,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date(0).toISOString(),
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date(0).toISOString(),
      messages: (item.messages as Conversation["messages"]).filter(
        (message) =>
          isRecord(message) &&
          typeof message.id === "string" &&
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string"
      ),
      archivedBranches: Array.isArray(item.archivedBranches)
        ? (item.archivedBranches as Conversation["archivedBranches"])
        : [],
      workspaceId: typeof item.workspaceId === "string" ? item.workspaceId : undefined,
      pinned: item.pinned === true,
      providerBinding:
        isRecord(item.providerBinding) &&
        typeof item.providerBinding.providerId === "string" &&
        typeof item.providerBinding.remoteThreadId === "string"
          ? {
              providerId: item.providerBinding.providerId,
              remoteThreadId: item.providerBinding.remoteThreadId
            }
          : undefined,
      providerOverride: providerPreference(item.providerOverride),
      contextKnowledgeIds: Array.isArray(item.contextKnowledgeIds)
        ? item.contextKnowledgeIds.filter((id): id is string => typeof id === "string")
        : [],
      modelId: typeof item.modelId === "string" ? item.modelId : undefined
    }));
}

function providerPreference(value: unknown): ProviderPreference | undefined {
  if (!isRecord(value) || typeof value.providerId !== "string") return undefined;
  return {
    providerId: value.providerId,
    modelId: typeof value.modelId === "string" ? value.modelId : undefined,
    reasoningEffort:
      typeof value.reasoningEffort === "string" ? value.reasoningEffort : undefined,
    serviceTier: typeof value.serviceTier === "string" ? value.serviceTier : undefined
  };
}

function workspaces(value: unknown): Workspace[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is Record<string, unknown> =>
        isRecord(item) && typeof item.id === "string" && typeof item.name === "string"
    )
    .map((item) => ({
      id: item.id as string,
      name: item.name as string,
      description: typeof item.description === "string" ? item.description : "",
      instructions: typeof item.instructions === "string" ? item.instructions : "",
      preference: providerPreference(item.preference),
      createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date(0).toISOString(),
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date(0).toISOString()
    }));
}

function knowledge(value: unknown, validWorkspaceIds: Set<string>): KnowledgeItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is Record<string, unknown> =>
        isRecord(item) &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.sourceFilename === "string" &&
        typeof item.workspaceId === "string" &&
        validWorkspaceIds.has(item.workspaceId) &&
        (item.type === "markdown" || item.type === "text") &&
        typeof item.content === "string" &&
        typeof item.managedPath === "string"
    )
    .map((item) => ({
      id: item.id as string,
      title: item.title as string,
      sourceFilename: item.sourceFilename as string,
      type: item.type as KnowledgeItem["type"],
      workspaceId: item.workspaceId as string,
      addedAt: typeof item.addedAt === "string" ? item.addedAt : new Date(0).toISOString(),
      size: typeof item.size === "number" && item.size >= 0 ? item.size : 0,
      managedPath: item.managedPath as string,
      content: item.content as string,
      status: item.status === "error" ? "error" : "ready"
    }));
}

function profileId(value: unknown): ProfileId {
  return ["general", "creative", "analytical", "concise", "custom"].includes(String(value))
    ? (value as ProfileId)
    : "general";
}

function safeNumber(
  value: unknown,
  fallback: number,
  valid: (candidate: number) => boolean
): number {
  return typeof value === "number" && Number.isFinite(value) && valid(value)
    ? value
    : fallback;
}

function generationSettings(value: unknown, fallback: GenerationSettings): GenerationSettings {
  const source = isRecord(value) ? value : {};
  return {
    systemInstructions:
      typeof source.systemInstructions === "string"
        ? source.systemInstructions
        : fallback.systemInstructions,
    temperature: safeNumber(source.temperature, fallback.temperature, (item) => item >= 0 && item <= 2),
    topP: safeNumber(source.topP, fallback.topP, (item) => item > 0 && item <= 1),
    topK: safeNumber(source.topK, fallback.topK, (item) => Number.isInteger(item) && item >= 0),
    repeatPenalty: safeNumber(source.repeatPenalty, fallback.repeatPenalty, (item) => item >= 0.5 && item <= 2),
    maxTokens: safeNumber(source.maxTokens, fallback.maxTokens, (item) => Number.isInteger(item) && item >= 1),
    context: safeNumber(source.context, fallback.context, (item) => Number.isInteger(item) && item >= 256),
    seed: safeNumber(source.seed, fallback.seed, Number.isInteger),
    stopSequences: Array.isArray(source.stopSequences)
      ? source.stopSequences.filter((item): item is string => typeof item === "string")
      : fallback.stopSequences
  };
}

function profiles(value: unknown): Profile[] {
  const stored = Array.isArray(value) ? value.filter(isRecord) : [];
  return DEFAULT_PROFILES.map((fallback) => {
    const source = stored.find((item) => item.id === fallback.id);
    if (!source) return structuredClone(fallback);
    return {
      id: fallback.id,
      name: typeof source.name === "string" ? source.name : fallback.name,
      description:
        typeof source.description === "string" ? source.description : fallback.description,
      settings: generationSettings(source.settings, fallback.settings)
    };
  });
}

function customProfile(value: unknown): Profile {
  const source = isRecord(value) ? value : {};
  return {
    id: "custom",
    name: typeof source.name === "string" ? source.name : DEFAULT_CUSTOM_PROFILE.name,
    description:
      typeof source.description === "string"
        ? source.description
        : DEFAULT_CUSTOM_PROFILE.description,
    settings: generationSettings(source.settings, DEFAULT_CUSTOM_PROFILE.settings)
  };
}

function runtimeConfig(value: unknown): LocalRuntimeConfig {
  const source = isRecord(value) ? value : {};
  const fallback = DEFAULT_MIND_STATE.runtime;
  return {
    mode: source.mode === "managed" ? "managed" : "external",
    endpoint: typeof source.endpoint === "string" ? source.endpoint : fallback.endpoint,
    executablePath:
      typeof source.executablePath === "string" ? source.executablePath : fallback.executablePath,
    modelPath: typeof source.modelPath === "string" ? source.modelPath : fallback.modelPath,
    port: safeNumber(source.port, fallback.port, (item) => Number.isInteger(item) && item >= 1024 && item <= 65535),
    context: safeNumber(source.context, fallback.context, (item) => Number.isInteger(item) && item >= 256 && item <= 1_048_576),
    gpuLayers: safeNumber(source.gpuLayers, fallback.gpuLayers, (item) => Number.isInteger(item) && item >= -1 && item <= 999)
  };
}

function userPreferences(value: unknown): UserPreferences {
  const source = isRecord(value) ? value : {};
  const fallback = DEFAULT_MIND_STATE.preferences;
  return {
    onboardingComplete:
      typeof source.onboardingComplete === "boolean"
        ? source.onboardingComplete
        : fallback.onboardingComplete,
    showBootIntro:
      typeof source.showBootIntro === "boolean" ? source.showBootIntro : fallback.showBootIntro,
    retainConversations:
      typeof source.retainConversations === "boolean"
        ? source.retainConversations
        : fallback.retainConversations
  };
}

function models(value: unknown): ModelDescriptor[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is ModelDescriptor =>
      isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.displayName === "string" &&
      typeof item.identifier === "string"
  );
}

export function migrateMindState(value: unknown): MindState {
  const source = isRecord(value) && isRecord(value.state) ? value.state : value;
  if (!isRecord(source)) return structuredClone(DEFAULT_MIND_STATE);

  const foundConversations = conversations(source.conversations ?? source.chats);
  const settings = isRecord(source.settings) ? source.settings : {};
  const runtime = isRecord(source.runtime) ? source.runtime : {};
  const preferences = isRecord(source.preferences) ? source.preferences : {};
  const foundWorkspaces = workspaces(source.workspaces);
  const validWorkspaceIds = new Set(foundWorkspaces.map((workspace) => workspace.id));
  const foundKnowledge = knowledge(source.knowledge, validWorkspaceIds);
  const knowledgeWorkspaceById = new Map(
    foundKnowledge.map((item) => [item.id, item.workspaceId])
  );
  const validConversations = foundConversations.map((conversation) => {
    const workspaceId = conversation.workspaceId && validWorkspaceIds.has(conversation.workspaceId)
      ? conversation.workspaceId
      : undefined;
    return {
      ...conversation,
      workspaceId,
      contextKnowledgeIds: workspaceId
        ? conversation.contextKnowledgeIds?.filter(
            (id) => knowledgeWorkspaceById.get(id) === workspaceId
          )
        : []
    };
  });
  const defaultPreference =
    providerPreference(source.defaultPreference) ??
    {
      providerId:
        typeof source.selectedProviderId === "string"
          ? source.selectedProviderId
          : DEFAULT_MIND_STATE.defaultPreference.providerId,
      modelId: typeof source.selectedModelId === "string" ? source.selectedModelId : undefined
    };
  const migrated: MindState = {
    ...structuredClone(DEFAULT_MIND_STATE),
    conversations: validConversations,
    selectedConversationId:
      typeof (source.selectedConversationId ?? source.activeChatId) === "string"
        ? String(source.selectedConversationId ?? source.activeChatId)
        : null,
    workspaces: foundWorkspaces,
    selectedWorkspaceId:
      typeof source.selectedWorkspaceId === "string" &&
      validWorkspaceIds.has(source.selectedWorkspaceId)
        ? source.selectedWorkspaceId
        : null,
    knowledge: foundKnowledge,
    profiles: profiles(source.profiles),
    selectedProfileId: profileId(source.selectedProfileId ?? source.profile),
    customProfile: customProfile(source.customProfile),
    models: models(source.models),
    selectedModelId: typeof source.selectedModelId === "string" ? source.selectedModelId : null,
    selectedProviderId:
      typeof source.selectedProviderId === "string"
        ? source.selectedProviderId
        : defaultPreference.providerId,
    defaultPreference,
    runtime: runtimeConfig(runtime),
    preferences: userPreferences(preferences)
  };

  if (!migrated.conversations.some((item) => item.id === migrated.selectedConversationId)) {
    migrated.selectedConversationId = migrated.conversations[0]?.id ?? null;
  }
  if (!migrated.models.some((item) => item.id === migrated.selectedModelId)) {
    migrated.selectedModelId = migrated.models[0]?.id ?? null;
  }
  if (Object.keys(settings).length && migrated.selectedProfileId === "custom") {
    migrated.customProfile.settings = generationSettings(
      settings,
      migrated.customProfile.settings
    );
  }
  return migrated;
}

export function loadMindState(storage: StorageLike): MindState {
  try {
    const stored = storage.getItem(MIND_STORAGE_KEY);
    return stored ? migrateMindState(JSON.parse(stored)) : structuredClone(DEFAULT_MIND_STATE);
  } catch {
    return structuredClone(DEFAULT_MIND_STATE);
  }
}

export function saveMindState(storage: StorageLike, state: MindState): boolean {
  try {
    storage.setItem(
      MIND_STORAGE_KEY,
      JSON.stringify({
        version: MIND_STORAGE_VERSION,
        state: state.preferences.retainConversations
          ? state
          : { ...state, conversations: [], selectedConversationId: null }
      })
    );
    return true;
  } catch {
    return false;
  }
}

export function clearMindState(storage: StorageLike): boolean {
  try {
    storage.removeItem(MIND_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
