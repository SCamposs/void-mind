import {
  appendMessage,
  createConversation,
  createWorkspace as createWorkspaceRecord,
  deleteConversation,
  deleteWorkspace as deleteWorkspaceRecord,
  editUserMessage,
  prepareRegeneration,
  renameConversation,
  resolveProfile,
  updateWorkspace as updateWorkspaceRecord,
  updateMessage,
  type Conversation,
  type GenerationSettings,
  type KnowledgeItem,
  type LocalRuntimeConfig,
  type MindState,
  type ModelDescriptor,
  type ProfileId,
  type ProviderBinding,
  type ProviderPreference,
  type Workspace,
  type UserPreferences
} from "@void-mind/mind-core";
import {
  DEFAULT_MIND_STATE,
  loadMindState,
  saveMindState
} from "@void-mind/persistence";
import type {
  CodexAccountState,
  CodexRuntimeStatus,
  ProviderHealth
} from "@void-mind/providers";
import { create } from "zustand";

export type AppSection = "home" | "conversations" | "workspaces" | "knowledge" | "models" | "settings";
export type GenerationState = "idle" | "connecting" | "generating" | "stopped" | "error";

type MindActions = {
  section: AppSection;
  navigationOpen: boolean;
  generationState: GenerationState;
  generationError: string | null;
  providerHealth: ProviderHealth | null;
  codexStatus: CodexRuntimeStatus | null;
  codexAccount: CodexAccountState | null;
  queuedGenerationId: string | null;
  storageHealthy: boolean;
  setSection(section: AppSection): void;
  setNavigationOpen(open: boolean): void;
  createConversation(workspaceId?: string): string;
  selectConversation(id: string): void;
  renameConversation(id: string, title: string): void;
  deleteConversation(id: string): void;
  pinConversation(id: string, pinned: boolean): void;
  setConversationBinding(id: string, binding: ProviderBinding): void;
  setConversationOverride(id: string, preference?: ProviderPreference): void;
  toggleConversationKnowledge(id: string, knowledgeId: string): void;
  appendMessage(role: "user" | "assistant", content: string, status?: "complete" | "streaming"): string;
  updateMessage(id: string, content: string, status: "complete" | "streaming" | "stopped" | "error"): void;
  editUserMessage(id: string, content: string): void;
  prepareRegeneration(): void;
  setGeneration(state: GenerationState, error?: string | null): void;
  setProviderHealth(health: ProviderHealth | null): void;
  setCodexStatus(status: CodexRuntimeStatus | null): void;
  setCodexAccount(account: CodexAccountState | null): void;
  queueGeneration(conversationId: string | null): void;
  setModels(models: ModelDescriptor[]): void;
  setProviderModels(providerId: string, models: ModelDescriptor[]): void;
  selectModel(id: string | null): void;
  setDefaultPreference(preference: ProviderPreference): void;
  createWorkspace(name: string): string;
  selectWorkspace(id: string | null): void;
  updateWorkspace(id: string, update: Partial<Pick<Workspace, "name" | "description" | "instructions" | "preference">>): void;
  deleteWorkspace(id: string): void;
  addKnowledge(item: KnowledgeItem): void;
  deleteKnowledge(id: string): void;
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
  section: "home",
  navigationOpen: false,
  generationState: "idle",
  generationError: null,
  providerHealth: null,
  codexStatus: null,
  codexAccount: null,
  queuedGenerationId: null,
  storageHealthy: true,
  setSection: (section) => set({ section, navigationOpen: false }),
  setNavigationOpen: (navigationOpen) => set({ navigationOpen }),
  createConversation: (workspaceId) => {
    const conversation = { ...createConversation(), workspaceId };
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
  pinConversation: (id, pinned) =>
    set((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation.id === id ? { ...conversation, pinned } : conversation
      )
    })),
  setConversationBinding: (id, providerBinding) =>
    set((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation.id === id ? { ...conversation, providerBinding } : conversation
      )
    })),
  setConversationOverride: (id, providerOverride) =>
    set((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation.id === id ? { ...conversation, providerOverride } : conversation
      )
    })),
  toggleConversationKnowledge: (id, knowledgeId) =>
    set((state) => ({
      conversations: state.conversations.map((conversation) => {
        if (conversation.id !== id) return conversation;
        const current = conversation.contextKnowledgeIds ?? [];
        return {
          ...conversation,
          contextKnowledgeIds: current.includes(knowledgeId)
            ? current.filter((item) => item !== knowledgeId)
            : [...current, knowledgeId]
        };
      })
    })),
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
  setCodexStatus: (codexStatus) => set({ codexStatus }),
  setCodexAccount: (codexAccount) => set({ codexAccount }),
  queueGeneration: (queuedGenerationId) => set({ queuedGenerationId }),
  setModels: (models) =>
    set((state) => ({
      models,
      selectedModelId:
        models.some((model) => model.id === state.selectedModelId)
          ? state.selectedModelId
          : models[0]?.id ?? null
    })),
  selectModel: (selectedModelId) => set({ selectedModelId }),
  setProviderModels: (providerId, providerModels) =>
    set((state) => {
      const models = [
        ...state.models.filter((model) => model.providerId !== providerId),
        ...providerModels
      ];
      const selectedModelId = models.some((model) => model.id === state.selectedModelId)
        ? state.selectedModelId
        : providerModels.find((model) => model.isDefault)?.id ?? models[0]?.id ?? null;
      return { models, selectedModelId };
    }),
  setDefaultPreference: (defaultPreference) =>
    set({
      defaultPreference,
      selectedProviderId: defaultPreference.providerId,
      selectedModelId: defaultPreference.modelId ?? null
    }),
  createWorkspace: (name) => {
    const workspace = createWorkspaceRecord(name);
    set((state) => ({
      workspaces: [workspace, ...state.workspaces],
      selectedWorkspaceId: workspace.id,
      section: "workspaces"
    }));
    return workspace.id;
  },
  selectWorkspace: (selectedWorkspaceId) => set({ selectedWorkspaceId }),
  updateWorkspace: (id, update) =>
    set((state) => ({
      workspaces: state.workspaces.map((workspace) =>
        workspace.id === id ? updateWorkspaceRecord(workspace, update) : workspace
      )
    })),
  deleteWorkspace: (id) =>
    set((state) => {
      const next = deleteWorkspaceRecord(state.workspaces, state.conversations, id);
      return {
        ...next,
        knowledge: state.knowledge.filter((item) => item.workspaceId !== id),
        selectedWorkspaceId:
          state.selectedWorkspaceId === id ? next.workspaces[0]?.id ?? null : state.selectedWorkspaceId
      };
    }),
  addKnowledge: (item) =>
    set((state) => ({ knowledge: [item, ...state.knowledge.filter((entry) => entry.id !== item.id)] })),
  deleteKnowledge: (id) =>
    set((state) => ({
      knowledge: state.knowledge.filter((item) => item.id !== id),
      conversations: state.conversations.map((conversation) => ({
        ...conversation,
        contextKnowledgeIds: conversation.contextKnowledgeIds?.filter((item) => item !== id)
      }))
    })),
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
    workspaces: state.workspaces,
    selectedWorkspaceId: state.selectedWorkspaceId,
    knowledge: state.knowledge,
    profiles: state.profiles,
    selectedProfileId: state.selectedProfileId,
    customProfile: state.customProfile,
    models: state.models,
    selectedModelId: state.selectedModelId,
    selectedProviderId: state.selectedProviderId,
    defaultPreference: state.defaultPreference,
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
