import { describe, expect, it, vi } from "vitest";
import { deleteKnowledgeFiles } from "./knowledge-bridge";

describe("deleteKnowledgeFiles", () => {
  it("reports every successful and failed managed-copy deletion", async () => {
    const remove = vi.fn(async (id: string) => {
      if (id === "knowledge-2") throw new Error("File is locked.");
    });

    await expect(deleteKnowledgeFiles(
      ["knowledge-1", "knowledge-2", "knowledge-3"],
      remove
    )).resolves.toEqual({
      deletedIds: ["knowledge-1", "knowledge-3"],
      failed: [{ id: "knowledge-2", message: "File is locked." }]
    });
    expect(remove).toHaveBeenCalledTimes(3);
  });
});
