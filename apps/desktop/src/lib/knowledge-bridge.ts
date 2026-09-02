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
