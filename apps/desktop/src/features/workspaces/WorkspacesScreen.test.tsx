import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { appendMessage, createConversation, createWorkspace, type KnowledgeItem } from "@void-mind/mind-core";
import { DEFAULT_MIND_STATE } from "@void-mind/persistence";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMindStore } from "../../stores/mind-store";
import { deleteKnowledgeFiles } from "../../lib/knowledge-bridge";
import { WorkspacesScreen } from "./WorkspacesScreen";

vi.mock("../../lib/knowledge-bridge", () => ({ deleteKnowledgeFiles: vi.fn() }));

describe("workspace management through the product surface", () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    useMindStore.setState({ ...structuredClone(DEFAULT_MIND_STATE), draftConversation: null });
  });

  it("keeps the workspace after partial cleanup and retries only remaining sources", async () => {
    const workspace = createWorkspace("Research");
    const conversation = appendMessage(createConversation("Keep this discussion"), "user", "A real discussion");
    conversation.workspaceId = workspace.id;
    const source = (id: string): KnowledgeItem => ({ id, title: id, sourceFilename: `${id}.md`, type: "markdown", workspaceId: workspace.id, addedAt: workspace.createdAt, size: 4, managedPath: `${id}.md`, content: "test", status: "ready" });
    conversation.contextKnowledgeIds = ["removed", "locked"];
    useMindStore.setState({ workspaces: [workspace], selectedWorkspaceId: workspace.id, conversations: [conversation], knowledge: [source("removed"), source("locked")] });
    vi.mocked(deleteKnowledgeFiles)
      .mockResolvedValueOnce({ deletedIds: ["removed"], failed: [{ id: "locked", message: "File is locked." }] })
      .mockResolvedValueOnce({ deletedIds: ["locked"], failed: [] });
    render(<WorkspacesScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Delete workspace" }));
    fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));
    await screen.findByRole("alert");
    expect(screen.getByRole("alert")).toHaveTextContent("workspace was kept");
    expect(useMindStore.getState().workspaces).toHaveLength(1);
    expect(useMindStore.getState().knowledge.map(item => item.id)).toEqual(["locked"]);
    expect(useMindStore.getState().conversations[0].contextKnowledgeIds).toEqual(["locked"]);

    fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));
    await waitFor(() => expect(useMindStore.getState().workspaces).toEqual([]));
    expect(deleteKnowledgeFiles).toHaveBeenNthCalledWith(1, ["removed", "locked"]);
    expect(deleteKnowledgeFiles).toHaveBeenNthCalledWith(2, ["locked"]);
    expect(useMindStore.getState().knowledge).toEqual([]);
    expect(useMindStore.getState().conversations[0]).toMatchObject({ id: conversation.id, messages: conversation.messages, contextKnowledgeIds: [] });
    expect(useMindStore.getState().conversations[0].workspaceId).toBeUndefined();
  });

  it("retains an unavailable model preference when saving unrelated instructions", () => {
    const workspace = createWorkspace("Research");
    workspace.preference = { providerId: "openai-chatgpt", modelId: "openai-chatgpt:unavailable", reasoningEffort: "low" };
    useMindStore.setState({ workspaces: [workspace], selectedWorkspaceId: workspace.id, models: [] });
    render(<WorkspacesScreen />);
    fireEvent.change(screen.getByRole("textbox", { name: "Instructions" }), { target: { value: "Answer in Portuguese." } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(useMindStore.getState().workspaces[0]).toMatchObject({ instructions: "Answer in Portuguese.", preference: workspace.preference });
  });
});
