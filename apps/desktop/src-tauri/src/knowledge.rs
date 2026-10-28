use serde::Serialize;
use std::{fs, io::Read, path::Path};
use tauri::Manager;

const MAX_KNOWLEDGE_BYTES: u64 = 512 * 1024;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedKnowledgeFile {
    source_filename: String,
    file_type: &'static str,
    size: u64,
    managed_path: String,
    content: String,
}

fn validate_item_id(item_id: &str) -> Result<(), String> {
    if item_id.is_empty()
        || item_id.len() > 80
        || !item_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Err("Knowledge item identifier is invalid.".into());
    }
    Ok(())
}

fn supported_type(path: &Path) -> Result<(&'static str, &'static str), String> {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "md" => Ok(("markdown", "md")),
        "txt" => Ok(("text", "txt")),
        _ => Err("VOID Mind currently supports Markdown and plain-text knowledge files.".into()),
    }
}

fn import_into(
    source_path: &Path,
    item_id: &str,
    app_data_path: &Path,
) -> Result<ImportedKnowledgeFile, String> {
    validate_item_id(item_id)?;
    let source = source_path
        .canonicalize()
        .map_err(|_| "The selected knowledge file is no longer available.".to_string())?;
    if !source.is_file() {
        return Err("The selected knowledge source is not a file.".into());
    }
    let (file_type, extension) = supported_type(&source)?;
    let metadata = fs::metadata(&source)
        .map_err(|error| format!("Could not inspect the selected knowledge file: {error}"))?;
    if metadata.len() > MAX_KNOWLEDGE_BYTES {
        return Err("Knowledge files must be 512 KB or smaller in this first version.".into());
    }
    // Bound the read itself: a source may grow after its metadata was inspected.
    let mut bytes = Vec::new();
    fs::File::open(&source)
        .and_then(|file| file.take(MAX_KNOWLEDGE_BYTES + 1).read_to_end(&mut bytes))
        .map_err(|error| format!("Could not read the selected knowledge file: {error}"))?;
    if bytes.len() as u64 > MAX_KNOWLEDGE_BYTES {
        return Err("Knowledge files must be 512 KB or smaller in this first version.".into());
    }
    let size = bytes.len() as u64;
    let content = String::from_utf8(bytes.clone())
        .map_err(|_| "The selected knowledge file is not valid UTF-8 text.".to_string())?;
    if content.trim().is_empty() {
        return Err("The selected knowledge file is empty.".into());
    }

    let knowledge_directory = app_data_path.join("knowledge");
    fs::create_dir_all(&knowledge_directory)
        .map_err(|error| format!("Could not prepare knowledge storage: {error}"))?;
    let destination = knowledge_directory.join(format!("{item_id}.{extension}"));
    fs::write(&destination, bytes)
        .map_err(|error| format!("Could not import the knowledge file: {error}"))?;

    Ok(ImportedKnowledgeFile {
        source_filename: source
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("Imported knowledge")
            .to_string(),
        file_type,
        size,
        managed_path: destination.to_string_lossy().into_owned(),
        content,
    })
}

#[tauri::command]
pub fn import_knowledge_file(
    app: tauri::AppHandle,
    source_path: String,
    item_id: String,
) -> Result<ImportedKnowledgeFile, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not locate app data: {error}"))?;
    import_into(Path::new(&source_path), &item_id, &app_data)
}

#[tauri::command]
pub fn delete_knowledge_file(app: tauri::AppHandle, item_id: String) -> Result<(), String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not locate app data: {error}"))?;
    delete_from(&item_id, &app_data)
}

fn delete_from(item_id: &str, app_data: &Path) -> Result<(), String> {
    validate_item_id(item_id)?;
    let directory = app_data.join("knowledge");
    for extension in ["md", "txt"] {
        let path = directory.join(format!("{item_id}.{extension}"));
        if path.is_file() {
            fs::remove_file(&path)
                .map_err(|error| format!("Could not remove imported knowledge: {error}"))?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{delete_from, import_into, supported_type, validate_item_id, MAX_KNOWLEDGE_BYTES};
    use std::{
        fs,
        path::{Path, PathBuf},
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn accepts_only_supported_text_types_and_safe_ids() {
        assert_eq!(supported_type(Path::new("notes.md")).unwrap().0, "markdown");
        assert_eq!(supported_type(Path::new("notes.txt")).unwrap().0, "text");
        assert!(supported_type(Path::new("notes.pdf")).is_err());
        assert!(validate_item_id("knowledge-123").is_ok());
        assert!(validate_item_id("../outside").is_err());
    }

    #[test]
    fn imports_a_copy_without_removing_the_original() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("void-mind-knowledge-{nonce}"));
        let source_directory = root.join("source");
        let app_data = root.join("app-data");
        fs::create_dir_all(&source_directory).unwrap();
        let source = source_directory.join("notes.md");
        fs::write(&source, "# Notes\nExplicit context.").unwrap();

        let imported = import_into(&source, "knowledge-1", &app_data).unwrap();
        assert_eq!(imported.file_type, "markdown");
        assert!(source.is_file());
        assert!(PathBuf::from(imported.managed_path).is_file());

        delete_from("knowledge-1", &app_data).unwrap();
        assert_eq!(
            fs::read_to_string(&source).unwrap(),
            "# Notes\nExplicit context."
        );
        assert!(!app_data.join("knowledge/knowledge-1.md").exists());
        delete_from("knowledge-1", &app_data).unwrap();

        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn rejects_invalid_content_without_creating_managed_files() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("void-mind-invalid-knowledge-{nonce}"));
        fs::create_dir_all(&root).unwrap();
        let app_data = root.join("app-data");
        let source = root.join("notes.txt");
        for (bytes, expected) in [
            (vec![b'x'; MAX_KNOWLEDGE_BYTES as usize + 1], "512 KB"),
            (vec![0xff, 0xfe], "UTF-8"),
            (b" \n\t".to_vec(), "empty"),
        ] {
            fs::write(&source, bytes).unwrap();
            assert!(import_into(&source, "knowledge-1", &app_data)
                .unwrap_err()
                .contains(expected));
            assert!(!app_data.exists());
        }
        fs::write(&source, vec![b'x'; MAX_KNOWLEDGE_BYTES as usize]).unwrap();
        let imported = import_into(&source, "knowledge-limit", &app_data).unwrap();
        assert_eq!(imported.size, MAX_KNOWLEDGE_BYTES);
        assert_eq!(imported.content.len(), MAX_KNOWLEDGE_BYTES as usize);
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn rejects_deletion_outside_the_managed_catalog() {
        let root = std::env::temp_dir().join("void-mind-unused-knowledge-root");
        for id in ["", "../notes", "..\\notes", "C:\\notes", "notes.txt"] {
            assert!(delete_from(id, &root).is_err());
        }
    }
}
