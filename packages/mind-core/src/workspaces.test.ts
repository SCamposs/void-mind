import { describe, expect, it } from "vitest";
import { createConversation } from "./conversations";
import {
  createWorkspace,
  deleteWorkspace,
  resolveProviderPreference,
  updateWorkspace
} from "./workspaces";

const clock = () => "2026-09-02T12:00:00.000Z";

describe("workspaces", () => {
  it("creates and updates explicit workspace context", () => {
    const workspace = createWorkspace("  Personal   Research ", clock, () => "workspace-1");
    expect(workspace.name).toBe("Personal Research");
    expect(
      updateWorkspace(workspace, {
        description: "  Long-form study  ",
        instructions: "  Answer in Portuguese.  ",
        preference: { providerId: "openai-codex", modelId: "codex:model" }
      }, clock)
    ).toMatchObject({
      description: "Long-form study",
      instructions: "Answer in Portuguese.",
      preference: { providerId: "openai-codex", modelId: "codex:model" }
    });
  });

  it("keeps conversations but removes ownership when a workspace is deleted", () => {
    const conversation = { ...createConversation(), workspaceId: "workspace-1" };
    const result = deleteWorkspace(
      [createWorkspace("Writing", clock, () => "workspace-1")],
      [conversation],
      "workspace-1"
    );
    expect(result.workspaces).toEqual([]);
    expect(result.conversations[0].workspaceId).toBeUndefined();
  });
});

describe("provider resolution", () => {
  const global = { providerId: "openai-codex", modelId: "codex:default" };
  const availableProviderIds = ["openai-codex", "void-local"];
  const availableModelIds = ["codex:default", "local:a0"];

  it("uses conversation, workspace, then global preference in that order", () => {
    const workspace = {
      ...createWorkspace("VOID"),
      preference: { providerId: "void-local", modelId: "local:a0" }
    };
    expect(resolveProviderPreference({ global, availableProviderIds, availableModelIds }).source)
      .toBe("global");
    expect(resolveProviderPreference({ workspace, global, availableProviderIds, availableModelIds }))
      .toMatchObject({ source: "workspace", preference: workspace.preference });
    expect(resolveProviderPreference({
      conversation: {
        ...createConversation(),
        providerOverride: { providerId: "openai-codex", modelId: "codex:default" }
      },
      workspace,
      global,
      availableProviderIds,
      availableModelIds
    }).source).toBe("conversation");
  });

  it("reports unavailability without silently falling back", () => {
    expect(resolveProviderPreference({
      global: { providerId: "missing", modelId: "missing:model" },
      availableProviderIds,
      availableModelIds
    })).toMatchObject({ available: false, modelAvailable: false });
  });
});
