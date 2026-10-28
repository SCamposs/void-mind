import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { open } from "@tauri-apps/plugin-dialog";
import { createWorkspace } from "@void-mind/mind-core";
import { DEFAULT_MIND_STATE } from "@void-mind/persistence";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteKnowledgeFile, importKnowledgeFile } from "../../lib/knowledge-bridge";
import { useMindStore } from "../../stores/mind-store";
import { KnowledgeScreen } from "./KnowledgeScreen";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("../../lib/knowledge-bridge", () => ({ importKnowledgeFile: vi.fn(), deleteKnowledgeFile: vi.fn() }));

describe("explicit Knowledge management through the product surface", () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.resetAllMocks();
    useMindStore.setState({ ...structuredClone(DEFAULT_MIND_STATE), draftConversation: null });
  });

  it("does not create an item after cancellation or a rejected import", async () => {
    const workspace = createWorkspace("Research");
    useMindStore.setState({ workspaces: [workspace], selectedWorkspaceId: workspace.id });
    vi.mocked(open).mockResolvedValueOnce(null).mockResolvedValueOnce("/selected/invalid.txt");
    vi.mocked(importKnowledgeFile).mockRejectedValueOnce(new Error("The selected file is not valid UTF-8."));
    render(<KnowledgeScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Import source" }));
    await waitFor(() => expect(open).toHaveBeenCalledOnce());
    expect(importKnowledgeFile).not.toHaveBeenCalled();
    expect(useMindStore.getState().knowledge).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Import source" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("not valid UTF-8");
    expect(useMindStore.getState().knowledge).toEqual([]);
  });

  it("imports into the selected workspace and retains context when removal fails", async () => {
    const workspace = createWorkspace("Research");
    useMindStore.setState({ workspaces: [workspace], selectedWorkspaceId: workspace.id });
    vi.mocked(open).mockResolvedValueOnce("/selected/study.md");
    vi.mocked(importKnowledgeFile).mockResolvedValueOnce({
      sourceFilename: "study.md", fileType: "markdown", size: 12,
      managedPath: "/managed/copy.md", content: "# Study\nText"
    });
    render(<KnowledgeScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Import source" }));
    await screen.findByRole("heading", { name: "study" });
    const item = useMindStore.getState().knowledge[0];
    expect(item).toMatchObject({ title: "study", workspaceId: workspace.id, sourceFilename: "study.md", managedPath: "/managed/copy.md", content: "# Study\nText", status: "ready" });
    expect(importKnowledgeFile).toHaveBeenCalledWith("/selected/study.md", item.id);

    const draftId = useMindStore.getState().createConversation(workspace.id);
    useMindStore.getState().toggleConversationKnowledge(draftId, item.id);
    vi.mocked(deleteKnowledgeFile).mockRejectedValueOnce(new Error("The managed copy is locked.")).mockResolvedValueOnce();
    fireEvent.click(screen.getByRole("button", { name: "Remove study" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("managed copy is locked");
    expect(useMindStore.getState().knowledge).toEqual([item]);
    expect(useMindStore.getState().draftConversation?.contextKnowledgeIds).toEqual([item.id]);

    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    await waitFor(() => expect(useMindStore.getState().knowledge).toEqual([]));
    expect(useMindStore.getState().draftConversation?.contextKnowledgeIds).toEqual([]);
    expect(deleteKnowledgeFile).toHaveBeenNthCalledWith(1, item.id);
    expect(deleteKnowledgeFile).toHaveBeenNthCalledWith(2, item.id);
  });
});
