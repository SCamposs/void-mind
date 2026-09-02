import type { Conversation, ProviderPreference, Workspace } from "./types";

type Clock = () => string;
type IdFactory = () => string;

const now: Clock = () => new Date().toISOString();
const makeId: IdFactory = () =>
  globalThis.crypto?.randomUUID?.() ??
  `workspace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

function requiredName(value: string): string {
  const name = value.trim().replace(/\s+/g, " ");
  if (!name) throw new Error("Workspace name cannot be empty.");
  if (name.length > 80) throw new Error("Workspace name must be 80 characters or fewer.");
  return name;
}

export function createWorkspace(
  name: string,
  clock: Clock = now,
  idFactory: IdFactory = makeId
): Workspace {
  const createdAt = clock();
  return {
    id: idFactory(),
    name: requiredName(name),
    description: "",
    instructions: "",
    createdAt,
    updatedAt: createdAt
  };
}

export function updateWorkspace(
  workspace: Workspace,
  update: Partial<Pick<Workspace, "name" | "description" | "instructions" | "preference">>,
  clock: Clock = now
): Workspace {
  return {
    ...workspace,
    ...update,
    name: update.name === undefined ? workspace.name : requiredName(update.name),
    description: update.description?.trim() ?? workspace.description,
    instructions: update.instructions?.trim() ?? workspace.instructions,
    updatedAt: clock()
  };
}

export function deleteWorkspace(
  workspaces: Workspace[],
  conversations: Conversation[],
  workspaceId: string
): { workspaces: Workspace[]; conversations: Conversation[] } {
  return {
    workspaces: workspaces.filter((workspace) => workspace.id !== workspaceId),
    conversations: conversations.map((conversation) =>
      conversation.workspaceId === workspaceId
        ? { ...conversation, workspaceId: undefined }
        : conversation
    )
  };
}

export type ProviderResolution = {
  preference: ProviderPreference;
  source: "conversation" | "workspace" | "global";
  available: boolean;
  modelAvailable: boolean;
};

export function resolveProviderPreference(options: {
  conversation?: Conversation;
  workspace?: Workspace;
  global: ProviderPreference;
  availableProviderIds: string[];
  availableModelIds: string[];
}): ProviderResolution {
  const preference =
    options.conversation?.providerOverride ?? options.workspace?.preference ?? options.global;
  const source = options.conversation?.providerOverride
    ? "conversation"
    : options.workspace?.preference
      ? "workspace"
      : "global";
  return {
    preference,
    source,
    available: options.availableProviderIds.includes(preference.providerId),
    modelAvailable:
      preference.modelId === undefined || options.availableModelIds.includes(preference.modelId)
  };
}
