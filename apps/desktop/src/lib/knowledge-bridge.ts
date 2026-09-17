import { invoke } from "@tauri-apps/api/core";

export type ImportedKnowledgeFile = {
  sourceFilename: string;
  fileType: "markdown" | "text";
  size: number;
  managedPath: string;
  content: string;
};

const isTauri = () => "__TAURI_INTERNALS__" in globalThis;

export async function importKnowledgeFile(
  sourcePath: string,
  itemId: string
): Promise<ImportedKnowledgeFile> {
  if (!isTauri()) throw new Error("Knowledge import is available in the desktop app.");
  return invoke("import_knowledge_file", { sourcePath, itemId });
}

export async function deleteKnowledgeFile(itemId: string): Promise<void> {
  if (!isTauri()) throw new Error("Knowledge management is available in the desktop app.");
  return invoke("delete_knowledge_file", { itemId });
}

export type KnowledgeDeletionReport = {
  deletedIds: string[];
  failed: Array<{ id: string; message: string }>;
};

export async function deleteKnowledgeFiles(
  itemIds: string[],
  remove: (itemId: string) => Promise<void> = deleteKnowledgeFile
): Promise<KnowledgeDeletionReport> {
  const results = await Promise.allSettled(itemIds.map((itemId) => remove(itemId)));
  return results.reduce<KnowledgeDeletionReport>((report, result, index) => {
    const id = itemIds[index];
    if (result.status === "fulfilled") report.deletedIds.push(id);
    else report.failed.push({
      id,
      message: result.reason instanceof Error ? result.reason.message : String(result.reason)
    });
    return report;
  }, { deletedIds: [], failed: [] });
}
