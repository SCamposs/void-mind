export type MessageRole = "user" | "assistant";
export type MessageStatus = "complete" | "streaming" | "stopped" | "error";

export type MindMessage = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  editedAt?: string;
  revisionOf?: string;
  status?: MessageStatus;
};

export type ConversationBranch = {
  id: string;
  reason: "edit" | "regenerate";
  forkedFromMessageId: string;
  createdAt: string;
  messages: MindMessage[];
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: MindMessage[];
  archivedBranches: ConversationBranch[];
  workspaceId?: string;
  pinned?: boolean;
  providerBinding?: ProviderBinding;
  providerOverride?: ProviderPreference;
  contextKnowledgeIds?: string[];
  modelId?: string;
};

export type ProviderBinding = {
  providerId: string;
  remoteThreadId: string;
};

export type ProviderPreference = {
  providerId: string;
  modelId?: string;
  reasoningEffort?: string;
  serviceTier?: string;
};

export type Workspace = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  preference?: ProviderPreference;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeType = "markdown" | "text";
export type KnowledgeStatus = "ready" | "error";

export type KnowledgeItem = {
  id: string;
  title: string;
  sourceFilename: string;
  type: KnowledgeType;
  workspaceId: string;
  addedAt: string;
  size: number;
  managedPath: string;
  content: string;
  status: KnowledgeStatus;
};

export type ProfileId = "general" | "creative" | "analytical" | "concise" | "custom";

export type GenerationSettings = {
  systemInstructions: string;
  temperature: number;
  topP: number;
  topK: number;
  repeatPenalty: number;
  maxTokens: number;
  context: number;
  seed: number;
  stopSequences: string[];
};

export type Profile = {
  id: ProfileId;
  name: string;
  description: string;
  settings: GenerationSettings;
};

export type ProviderCapabilities = {
  streaming: boolean;
  cancellation: boolean;
  files?: boolean;
  vision?: boolean;
  images?: boolean;
  audio?: boolean;
  tools?: boolean;
  reasoning?: boolean;
  local?: boolean;
  remote?: boolean;
  accountAuth?: boolean;
  threadPersistence?: boolean;
};

export type ReasoningEffortDescriptor = {
  id: string;
  description: string;
};

export type ServiceTierDescriptor = {
  id: string;
  name: string;
  description: string;
};

export type ModelDescriptor = {
  id: string;
  displayName: string;
  identifier: string;
  version: string;
  providerId: string;
  location: "local" | "remote";
  baseModel?: string;
  format?: string;
  quantization?: string;
  context?: number;
  languages: string[];
  capabilities: string[];
  description?: string;
  isDefault?: boolean;
  reasoningEfforts?: ReasoningEffortDescriptor[];
  defaultReasoningEffort?: string;
  inputModalities?: string[];
  supportsPersonality?: boolean;
  serviceTiers?: ServiceTierDescriptor[];
  defaultServiceTier?: string;
  source?: string;
  license?: string;
  hash?: string;
  creator?: string;
  trainingLineage?: string[];
  chatTemplate?: string;
  modelPath?: string;
  manifestPath?: string;
};

export type RuntimeMode = "external" | "managed";

export type LocalRuntimeConfig = {
  mode: RuntimeMode;
  endpoint: string;
  executablePath: string;
  modelPath: string;
  port: number;
  context: number;
  gpuLayers: number;
};

export type UserPreferences = {
  onboardingComplete: boolean;
  showBootIntro: boolean;
  retainConversations: boolean;
};

export type MindState = {
  conversations: Conversation[];
  selectedConversationId: string | null;
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  knowledge: KnowledgeItem[];
  profiles: Profile[];
  selectedProfileId: ProfileId;
  customProfile: Profile;
  models: ModelDescriptor[];
  selectedModelId: string | null;
  selectedProviderId: string;
  defaultPreference: ProviderPreference;
  runtime: LocalRuntimeConfig;
  preferences: UserPreferences;
};
