import {
  appendMessage,
  createConversation,
  deleteConversation,
  editUserMessage,
  prepareRegeneration,
  renameConversation,
  resolveProfile,
  updateMessage,
  type Conversation,
  type GenerationSettings,
  type LocalRuntimeConfig,
  type MindState,
  type ModelDescriptor,
  type ProfileId,
  type UserPreferences
} from "@void-mind/mind-core";
import {
  DEFAULT_MIND_STATE,
  loadMindState,
  saveMindState
} from "@void-mind/persistence";
import type { ProviderHealth } from "@void-mind/providers";
import { create } from "zustand";

export type AppSection = "conversations" | "workspaces" | "knowledge" | "models" | "settings";
export type GenerationState = "idle" | "connecting" | "generating" | "stopped" | "error";

type MindActions = {
  section: AppSection;
  navigationOpen: boolean;
  generationState: GenerationState;
  generationError: string | null;
  providerHealth: ProviderHealth | null;
  storageHealthy: boolean;
  setSection(section: AppSection): void;
  setNavigationOpen(open: boolean): void;
  createConversation(): string;
  selectConversation(id: string): void;
  renameConversation(id: string, title: string): void;
  deleteConversation(id: string): void;
  appendMessage(role: "user" | "assistant", content: string, status?: "complete" | "streaming"): string;
  updateMessage(id: string, content: string, status: "complete" | "streaming" | "stopped" | "error"): void;
  editUserMessage(id: string, content: string): void;
  prepareRegeneration(): void;
  setGeneration(state: GenerationState, error?: string | null): void;
  setProviderHealth(health: ProviderHealth | null): void;
  setModels(models: ModelDescriptor[]): void;
  selectModel(id: string | null): void;
  updateRuntime(update: Partial<LocalRuntimeConfig>): void;
  selectProfile(id: ProfileId): void;
  updateCustomSettings(update: Partial<GenerationSettings>): void;
  updatePreferences(update: Partial<UserPreferences>): void;
};

export type MindStore = MindState & MindActions;

const storage = typeof window === "undefined" ? null : window.localStorage;
const initial = storage ? loadMindState(storage) : structuredClone(DEFAULT_MIND_STATE);

function selected(state: MindStore): Conversation | undefined {
  return state.conversations.find((conversation) => conversation.id === state.selectedConversationId);
}

function replaceSelected(state: MindStore, conversation: Conversation): Partial<MindStore> {
  return {
    conversations: state.conversations.map((item) =>
      item.id === conversation.id ? conversation : item
    )
  };
}

export const useMindStore = create<MindStore>()((set) => ({
  ...initial,
  section: "conversations",
  navigationOpen: false,
  generationState: "idle",
  generationError: null,
  providerHealth: null,
  storageHealthy: true,
  setSection: (section) => set({ section, navigationOpen: false }),
  setNavigationOpen: (navigationOpen) => set({ navigationOpen }),
  createConversation: () => {
    const conversation = createConversation();
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      selectedConversationId: conversation.id,
      section: "conversations"
    }));
    return conversation.id;
  },
  selectConversation: (selectedConversationId) =>
    set({ selectedConversationId, section: "conversations", navigationOpen: false }),
  renameConversation: (id, title) =>
    set((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation.id === id ? renameConversation(conversation, title) : conversation
      )
    })),
  deleteConversation: (id) =>
    set((state) => {
      const conversations = deleteConversation(state.conversations, id);
      return {
        conversations,
        selectedConversationId:
          state.selectedConversationId === id
            ? conversations[0]?.id ?? null
            : state.selectedConversationId
      };
    }),
  appendMessage: (role, content, status = "complete") => {
    let messageId = "";
    set((state) => {
      let conversation = selected(state);
      if (!conversation) conversation = createConversation();
      const next = appendMessage(conversation, role, content, { status });
      messageId = next.messages.at(-1)?.id ?? "";
      const exists = state.conversations.some((item) => item.id === next.id);
      return {
        conversations: exists
          ? state.conversations.map((item) => (item.id === next.id ? next : item))
          : [next, ...state.conversations],
        selectedConversationId: next.id
      };
    });
    return messageId;
  },
  updateMessage: (id, content, status) =>
    set((state) => {
      const conversation = selected(state);
      return conversation
        ? replaceSelected(state, updateMessage(conversation, id, { content, status }))
        : {};
    }),
  editUserMessage: (id, content) =>
    set((state) => {
      const conversation = selected(state);
      return conversation ? replaceSelected(state, editUserMessage(conversation, id, content)) : {};
    }),
  prepareRegeneration: () =>
    set((state) => {
      const conversation = selected(state);
      return conversation ? replaceSelected(state, prepareRegeneration(conversation)) : {};
    }),
  setGeneration: (generationState, generationError = null) =>
    set({ generationState, generationError }),
  setProviderHealth: (providerHealth) => set({ providerHealth }),
  setModels: (models) =>
    set((state) => ({
      models,
      selectedModelId:
        models.some((model) => model.id === state.selectedModelId)
          ? state.selectedModelId
          : models[0]?.id ?? null
    })),
  selectModel: (selectedModelId) => set({ selectedModelId }),
  updateRuntime: (update) =>
    set((state) => ({ runtime: { ...state.runtime, ...update }, providerHealth: null })),
  selectProfile: (selectedProfileId) => set({ selectedProfileId }),
  updateCustomSettings: (update) =>
    set((state) => ({
      customProfile: {
        ...state.customProfile,
        settings: { ...state.customProfile.settings, ...update }
      },
      selectedProfileId: "custom"
    })),
  updatePreferences: (update) =>
    set((state) => ({ preferences: { ...state.preferences, ...update } }))
}));

useMindStore.subscribe((state) => {
  if (!storage) return;
  const persisted: MindState = {
    conversations: state.conversations,
    selectedConversationId: state.selectedConversationId,
    profiles: state.profiles,
    selectedProfileId: state.selectedProfileId,
    customProfile: state.customProfile,
    models: state.models,
    selectedModelId: state.selectedModelId,
    selectedProviderId: state.selectedProviderId,
    runtime: state.runtime,
    preferences: state.preferences
  };
  const healthy = saveMindState(storage, persisted);
  if (healthy !== state.storageHealthy) {
    useMindStore.setState({ storageHealthy: healthy });
  }
});

export function activeSettings(state: MindStore): GenerationSettings {
  return resolveProfile(
    state.profiles,
    state.customProfile,
    state.selectedProfileId
  ).settings;
}
