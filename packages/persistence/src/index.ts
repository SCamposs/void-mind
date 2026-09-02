import {
  DEFAULT_CUSTOM_PROFILE,
  DEFAULT_GENERATION_SETTINGS,
  DEFAULT_PROFILES,
  type Conversation,
  type MindState,
  type ModelDescriptor,
  type Profile,
  type ProfileId
} from "@void-mind/mind-core";

export const MIND_STORAGE_KEY = "void-mind:state";
export const MIND_STORAGE_VERSION = 2;

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const DEFAULT_MIND_STATE: MindState = {
  conversations: [],
  selectedConversationId: null,
  profiles: structuredClone(DEFAULT_PROFILES),
  selectedProfileId: "general",
  customProfile: structuredClone(DEFAULT_CUSTOM_PROFILE),
  models: [],
  selectedModelId: null,
  selectedProviderId: "void-local",
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
      modelId: typeof item.modelId === "string" ? item.modelId : undefined
    }));
}

function profileId(value: unknown): ProfileId {
  return ["general", "creative", "analytical", "concise", "custom"].includes(String(value))
    ? (value as ProfileId)
    : "general";
}

function profiles(value: unknown): Profile[] {
  return Array.isArray(value) && value.length ? (value as Profile[]) : structuredClone(DEFAULT_PROFILES);
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
  const migrated: MindState = {
    ...structuredClone(DEFAULT_MIND_STATE),
    conversations: foundConversations,
    selectedConversationId:
      typeof (source.selectedConversationId ?? source.activeChatId) === "string"
        ? String(source.selectedConversationId ?? source.activeChatId)
        : null,
    profiles: profiles(source.profiles),
    selectedProfileId: profileId(source.selectedProfileId ?? source.profile),
    customProfile: isRecord(source.customProfile)
      ? (source.customProfile as unknown as Profile)
      : structuredClone(DEFAULT_CUSTOM_PROFILE),
    models: models(source.models),
    selectedModelId: typeof source.selectedModelId === "string" ? source.selectedModelId : null,
    selectedProviderId:
      typeof source.selectedProviderId === "string" ? source.selectedProviderId : "void-local",
    runtime: {
      ...DEFAULT_MIND_STATE.runtime,
      ...(runtime as Partial<MindState["runtime"]>)
    },
    preferences: {
      ...DEFAULT_MIND_STATE.preferences,
      ...preferences
    }
  };

  if (!migrated.conversations.some((item) => item.id === migrated.selectedConversationId)) {
    migrated.selectedConversationId = migrated.conversations[0]?.id ?? null;
  }
  if (!migrated.models.some((item) => item.id === migrated.selectedModelId)) {
    migrated.selectedModelId = migrated.models[0]?.id ?? null;
  }
  if (Object.keys(settings).length && migrated.selectedProfileId === "custom") {
    migrated.customProfile.settings = {
      ...DEFAULT_GENERATION_SETTINGS,
      ...(settings as Partial<typeof DEFAULT_GENERATION_SETTINGS>)
    };
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
