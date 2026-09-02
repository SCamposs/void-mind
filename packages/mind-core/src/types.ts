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
  modelId?: string;
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
  tools?: boolean;
  reasoning?: boolean;
  local?: boolean;
  accountAuth?: boolean;
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
  profiles: Profile[];
  selectedProfileId: ProfileId;
  customProfile: Profile;
  models: ModelDescriptor[];
  selectedModelId: string | null;
  selectedProviderId: string;
  runtime: LocalRuntimeConfig;
  preferences: UserPreferences;
};
