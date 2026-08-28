use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum FileCategory {
    Markdown,
    Code,
    Html,
    Data,
    Image,
    Audio,
    Video,
    Document,
    Archive,
    Other,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileMetadata {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified_ms: u64,
    pub extension: Option<String>,
    pub category: FileCategory,
    pub is_binary: bool,
    pub is_hidden: bool,
    pub readonly: bool,
}

pub fn detect_category_and_binary(extension: Option<&str>, is_dir: bool) -> (FileCategory, bool) {
    if is_dir {
        return (FileCategory::Other, false);
    }

    let ext = match extension.map(|s| s.to_ascii_lowercase()) {
        Some(e) => e,
        None => return (FileCategory::Other, false),
    };

    match ext.as_str() {
        // Markdown (Text)
        "md" | "markdown" | "mdx" => (FileCategory::Markdown, false),

        // HTML (Text)
        "html" | "htm" | "xhtml" => (FileCategory::Html, false),

        // Data (Text vs Binary Spreadsheet)
        "json" | "jsonc" | "yaml" | "yml" | "toml" | "csv" | "tsv" | "xml" | "env" | "log" => {
            (FileCategory::Data, false)
        }
        "xlsx" | "xls" | "xlsm" | "xlsb" | "ods" => (FileCategory::Data, true),

        // Images (SVG is text-compatible, others binary)
        "svg" => (FileCategory::Image, false),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp" | "ico" | "tiff" | "psd" => {
            (FileCategory::Image, true)
        }

        // Audio & Video (Binary)
        "mp3" | "wav" | "ogg" | "m4a" | "flac" | "aac" | "wma" => (FileCategory::Audio, true),
        "mp4" | "webm" | "mkv" | "mov" | "avi" | "flv" | "wmv" => (FileCategory::Video, true),

        // Documents (PDF/Office Binary vs TXT)
        "txt" | "rtf" => (FileCategory::Document, false),
        "pdf" | "doc" | "docx" | "ppt" | "pptx" | "epub" => (FileCategory::Document, true),

        // Source Code (Text)
        "ts" | "tsx" | "js" | "jsx" | "mjs" | "cjs" | "rs" | "py" | "go" | "java" | "c"
        | "cpp" | "h" | "hpp" | "cs" | "rb" | "php" | "sh" | "bash" | "zsh" | "bat" | "ps1"
        | "sql" | "css" | "scss" | "sass" | "less" | "vue" | "svelte" | "lua" | "swift"
        | "kt" | "kts" | "dart" | "zig" | "scala" | "r" | "perl" | "dockerfile" | "proto"
        | "graphql" | "prisma" | "lock" | "ini" | "cfg" | "conf" => (FileCategory::Code, false),

        // Archives (binary, previewable)
        "zip" | "jar" | "war" | "ear" | "apk" | "ipa" | "whl" | "egg"
        | "tar" | "gz" | "tgz" | "bz2" | "xz" | "zst"
        | "rar" | "7z" | "iso" | "cab" | "deb" | "rpm" => (FileCategory::Archive, true),

        // Binary executables, databases, etc.
        "exe" | "dll" | "so" | "dylib"
        | "bin" | "wasm" | "parquet" | "arrow" | "db" | "sqlite" | "sqlite3"
        | "class" | "pyc" => (FileCategory::Other, true),

        _ => (FileCategory::Other, false),
    }
}

pub fn detect_category(extension: Option<&str>, is_dir: bool) -> FileCategory {
    detect_category_and_binary(extension, is_dir).0
}

#[cfg(target_os = "windows")]
pub fn check_is_hidden(path: &Path, name: &str) -> bool {
    if name.starts_with('.') {
        return true;
    }
    use std::os::windows::fs::MetadataExt;
    if let Ok(meta) = fs::metadata(path) {
        return (meta.file_attributes() & 0x2) != 0;
    }
    false
}

#[cfg(not(target_os = "windows"))]
pub fn check_is_hidden(_path: &Path, name: &str) -> bool {
    name.starts_with('.')
}

pub fn get_file_metadata<P: AsRef<Path>>(path: P) -> Result<FileMetadata, String> {
    let p = path.as_ref();
    let meta = fs::metadata(p).map_err(|e| format!("Failed to read metadata for {:?}: {}", p, e))?;

    let is_dir = meta.is_dir();
    let name = p
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| p.to_string_lossy().to_string());

    let extension = if is_dir {
        None
    } else {
        p.extension().map(|e| e.to_string_lossy().to_string())
    };

    let (category, is_binary) = detect_category_and_binary(extension.as_deref(), is_dir);
    let is_hidden = check_is_hidden(p, &name);

    let modified_ms = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let size = if is_dir { 0 } else { meta.len() };
    let readonly = meta.permissions().readonly();

    // Canonicalize or normalize path representation
    let path_str = p.to_string_lossy().to_string().replace('\\', "/");

    Ok(FileMetadata {
        name,
        path: path_str,
        is_dir,
        size,
        modified_ms,
        extension,
        category,
        is_binary,
        is_hidden,
        readonly,
    })
}

#[tauri::command]
pub fn list_directory(path: String) -> Result<Vec<FileMetadata>, String> {
    let dir_path = Path::new(&path);
    if !dir_path.exists() {
        return Err(format!("Directory does not exist: {}", path));
    }
    if !dir_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let entries = fs::read_dir(dir_path).map_err(|e| format!("Failed to read directory: {}", e))?;
    let mut results = Vec::new();

    for entry_res in entries {
        if let Ok(entry) = entry_res {
            let item_path = entry.path();
            if let Ok(metadata) = get_file_metadata(&item_path) {
                results.push(metadata);
            }
        }
    }

    // Sort: directories first, then alphabetical (case-insensitive)
    results.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(results)
}

const MAX_TEXT_READ_BYTES: usize = 2 * 1024 * 1024; // 2MB display limit for text files

#[tauri::command]
pub fn read_file_text(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("File does not exist: {}", path));
    }
    if p.is_dir() {
        return Err(format!("Cannot read a directory as text: {}", path));
    }

    // Check extension & metadata first
    if let Ok(meta) = get_file_metadata(p) {
        if meta.is_binary {
            return Err(format!("Cannot read binary file '{}' as text", meta.name));
        }
    }

    let file = File::open(p).map_err(|e| format!("Failed to open file: {}", e))?;
    let mut buffer = Vec::new();

    // Read up to limit + 1 to check if truncated
    let mut take = file.take((MAX_TEXT_READ_BYTES + 1) as u64);
    take.read_to_end(&mut buffer).map_err(|e| format!("Failed to read file bytes: {}", e))?;

    let is_truncated = buffer.len() > MAX_TEXT_READ_BYTES;
    if is_truncated {
        buffer.truncate(MAX_TEXT_READ_BYTES);
    }

    // Quick null byte check in initial slice (if it contains null bytes, it is binary)
    let sample_len = buffer.len().min(4096);
    if buffer[..sample_len].contains(&0) {
        return Err("File appears to contain binary data".to_string());
    }

    let mut text = String::from_utf8_lossy(&buffer).to_string();
    if is_truncated {
        text.push_str("\n\n--- [TRUNCATED: File exceeds 2MB preview limit] ---");
    }

    Ok(text)
}

#[tauri::command]
pub fn read_file_binary_base64(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    let bytes = fs::read(p).map_err(|e| format!("Failed to read binary file: {}", e))?;
    Ok(BASE64.encode(&bytes))
}

#[tauri::command]
pub fn write_file_text(path: String, content: String) -> Result<(), String> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directories: {}", e))?;
        }
    }
    fs::write(p, content.as_bytes()).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
pub fn create_file(parent_path: String, name: String) -> Result<FileMetadata, String> {
    let parent = Path::new(&parent_path);
    if !parent.exists() {
        fs::create_dir_all(parent).map_err(|e| format!("Parent path does not exist: {}", e))?;
    }

    let new_path = parent.join(&name);
    if new_path.exists() {
        return Err(format!("Item already exists at {:?}", new_path));
    }

    fs::write(&new_path, b"").map_err(|e| format!("Failed to create file: {}", e))?;
    get_file_metadata(&new_path)
}

#[tauri::command]
pub fn create_directory(parent_path: String, name: String) -> Result<FileMetadata, String> {
    let parent = Path::new(&parent_path);
    let new_dir_path = parent.join(&name);
    if new_dir_path.exists() {
        return Err(format!("Directory already exists at {:?}", new_dir_path));
    }

    fs::create_dir_all(&new_dir_path).map_err(|e| format!("Failed to create directory: {}", e))?;
    get_file_metadata(&new_dir_path)
}

#[tauri::command]
pub fn rename_item(source_path: String, new_name: String) -> Result<String, String> {
    let src = PathBuf::from(&source_path);
    if !src.exists() {
        return Err(format!("Source does not exist: {}", source_path));
    }

    let parent = src.parent().ok_or("Cannot rename root path")?;
    let dst = parent.join(&new_name);

    if dst.exists() {
        return Err(format!("An item named '{}' already exists in this folder", new_name));
    }

    fs::rename(&src, &dst).map_err(|e| format!("Failed to rename: {}", e))?;
    Ok(dst.to_string_lossy().to_string().replace('\\', "/"))
}

fn copy_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    if src.is_dir() {
        fs::create_dir_all(dst)?;
        for entry in fs::read_dir(src)? {
            let entry = entry?;
            let entry_dst = dst.join(entry.file_name());
            copy_recursive(&entry.path(), &entry_dst)?;
        }
    } else {
        fs::copy(src, dst)?;
    }
    Ok(())
}

#[tauri::command]
pub fn copy_items(sources: Vec<String>, target_dir: String) -> Result<Vec<String>, String> {
    let target = Path::new(&target_dir);
    if !target.exists() || !target.is_dir() {
        return Err(format!("Target is not a valid directory: {}", target_dir));
    }

    let mut copied_paths = Vec::new();

    for src_str in sources {
        let src = Path::new(&src_str);
        if !src.exists() {
            continue;
        }

        let file_name = src.file_name().ok_or_else(|| format!("Invalid source path: {}", src_str))?;
        let mut dest = target.join(file_name);

        if dest.exists() {
            let stem = src.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
            let ext = src.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
            let mut counter = 1;
            loop {
                let candidate = target.join(format!("{} - Copy ({}){}", stem, counter, ext));
                if !candidate.exists() {
                    dest = candidate;
                    break;
                }
                counter += 1;
            }
        }

        copy_recursive(src, &dest).map_err(|e| format!("Failed to copy {:?} to {:?}: {}", src, dest, e))?;
        copied_paths.push(dest.to_string_lossy().to_string().replace('\\', "/"));
    }

    Ok(copied_paths)
}

#[tauri::command]
pub fn move_items(sources: Vec<String>, target_dir: String) -> Result<Vec<String>, String> {
    let target = Path::new(&target_dir);
    if !target.exists() || !target.is_dir() {
        return Err(format!("Target is not a valid directory: {}", target_dir));
    }

    let mut moved_paths = Vec::new();

    for src_str in sources {
        let src = Path::new(&src_str);
        if !src.exists() {
            continue;
        }

        let file_name = src.file_name().ok_or_else(|| format!("Invalid source path: {}", src_str))?;
        let dest = target.join(file_name);

        if dest.exists() && dest != src {
            return Err(format!("Item already exists at destination: {:?}", dest));
        }

        if fs::rename(src, &dest).is_err() {
            copy_recursive(src, &dest).map_err(|e| format!("Failed to move {:?}: {}", src, e))?;
            if src.is_dir() {
                let _ = fs::remove_dir_all(src);
            } else {
                let _ = fs::remove_file(src);
            }
        }

        moved_paths.push(dest.to_string_lossy().to_string().replace('\\', "/"));
    }

    Ok(moved_paths)
}

#[tauri::command]
pub fn delete_items(paths: Vec<String>, permanent: bool) -> Result<(), String> {
    for p_str in paths {
        let p = Path::new(&p_str);
        if !p.exists() {
            continue;
        }

        if permanent {
            if p.is_dir() {
                fs::remove_dir_all(p).map_err(|e| format!("Failed to permanently remove directory {:?}: {}", p, e))?;
            } else {
                fs::remove_file(p).map_err(|e| format!("Failed to permanently remove file {:?}: {}", p, e))?;
            }
        } else {
            trash::delete(p).map_err(|e| format!("Failed to move {:?} to trash: {}", p, e))?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_file_categorization() {
        let (cat, is_bin) = detect_category_and_binary(Some("md"), false);
        assert_eq!(cat, FileCategory::Markdown);
        assert!(!is_bin);

        let (cat, is_bin) = detect_category_and_binary(Some("xlsx"), false);
        assert_eq!(cat, FileCategory::Data);
        assert!(is_bin);

        let (cat, is_bin) = detect_category_and_binary(Some("ts"), false);
        assert_eq!(cat, FileCategory::Code);
        assert!(!is_bin);

        let (cat, is_bin) = detect_category_and_binary(Some("png"), false);
        assert_eq!(cat, FileCategory::Image);
        assert!(is_bin);

        let (cat, is_bin) = detect_category_and_binary(Some("pdf"), false);
        assert_eq!(cat, FileCategory::Document);
        assert!(is_bin);
    }

    #[test]
    fn test_fs_operations_crud() {
        let temp_dir = std::env::temp_dir().join(format!("pfile_test_{}", std::time::SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));
        fs::create_dir_all(&temp_dir).unwrap();

        let temp_dir_str = temp_dir.to_string_lossy().to_string();

        let file_meta = create_file(temp_dir_str.clone(), "test_doc.md".to_string()).unwrap();
        assert_eq!(file_meta.name, "test_doc.md");
        assert_eq!(file_meta.category, FileCategory::Markdown);
        assert!(!file_meta.is_binary);
        assert!(!file_meta.is_hidden);

        let dotfile = create_file(temp_dir_str.clone(), ".env.local".to_string()).unwrap();
        assert!(dotfile.is_hidden);
        write_file_text(file_meta.path.clone(), "# Hello Pfile\nSample content".to_string()).unwrap();
        let content = read_file_text(file_meta.path.clone()).unwrap();
        assert_eq!(content, "# Hello Pfile\nSample content");

        let renamed_path = rename_item(file_meta.path.clone(), "renamed_doc.md".to_string()).unwrap();
        assert!(Path::new(&renamed_path).exists());

        let items = list_directory(temp_dir_str.clone()).unwrap();
        assert_eq!(items.len(), 2);

        let sub_dir = create_directory(temp_dir_str.clone(), "sub_folder".to_string()).unwrap();
        let moved = move_items(vec![renamed_path, dotfile.path], sub_dir.path.clone()).unwrap();
        assert_eq!(moved.len(), 2);
        delete_items(vec![sub_dir.path], true).unwrap();
        let final_items = list_directory(temp_dir_str.clone()).unwrap();
        assert_eq!(final_items.len(), 0);

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
