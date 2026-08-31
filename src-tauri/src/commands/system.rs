use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::Ordering;
use std::time::UNIX_EPOCH;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;
use crate::commands::fs_ops::{detect_category_and_binary, check_is_hidden, FileMetadata};
use crate::state::AppState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuickPathItem {
    pub name: String,
    pub path: String,
    pub kind: String,
}

/// Matches `text` against `query`. If `query` contains glob wildcards (`*` for any
/// run of characters, `?` for a single character), it is matched as a full-string
/// glob pattern; otherwise it falls back to a plain substring match. Both inputs
/// are expected to already be lowercased by the caller.
fn matches_query(text: &str, query: &str) -> bool {
    if query.contains('*') || query.contains('?') {
        wildcard_match(text.as_bytes(), query.as_bytes())
    } else {
        text.contains(query)
    }
}

/// Classic DP-free glob matcher for `*` and `?` (case handled by the caller).
fn wildcard_match(text: &[u8], pattern: &[u8]) -> bool {
    let (mut ti, mut pi) = (0, 0);
    let (mut star_idx, mut match_idx) = (None, 0);

    while ti < text.len() {
        if pi < pattern.len() && (pattern[pi] == b'?' || pattern[pi] == text[ti]) {
            ti += 1;
            pi += 1;
        } else if pi < pattern.len() && pattern[pi] == b'*' {
            star_idx = Some(pi);
            match_idx = ti;
            pi += 1;
        } else if let Some(si) = star_idx {
            pi = si + 1;
            match_idx += 1;
            ti = match_idx;
        } else {
            return false;
        }
    }

    while pi < pattern.len() && pattern[pi] == b'*' {
        pi += 1;
    }

    pi == pattern.len()
}

#[tauri::command]
pub fn show_in_file_manager(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    #[cfg(target_os = "windows")]
    {
        let win_path = path.replace('/', "\\");
        let status = Command::new("explorer")
            .arg(format!("/select,{}", win_path))
            .status()
            .map_err(|e| format!("Failed to open Windows Explorer: {}", e))?;

        if !status.success() {
            if let Some(parent) = p.parent() {
                let _ = Command::new("explorer").arg(parent).status();
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-R", &path])
            .status()
            .map_err(|e| format!("Failed to open Finder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(parent) = p.parent() {
            Command::new("xdg-open")
                .arg(parent)
                .status()
                .map_err(|e| format!("Failed to open file manager: {}", e))?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn open_in_default_app(path: String) -> Result<(), String> {
    open::that(&path).map_err(|e| format!("Failed to open with default application: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn get_home_dir() -> Result<String, String> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    Ok(home.replace('\\', "/"))
}

#[tauri::command]
pub fn get_quick_access_paths() -> Result<Vec<QuickPathItem>, String> {
    let mut items = Vec::new();
    let home_str = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    let home_path = PathBuf::from(&home_str);

    items.push(QuickPathItem {
        name: "Home".to_string(),
        path: home_str.replace('\\', "/"),
        kind: "home".to_string(),
    });

    let desktop = home_path.join("Desktop");
    if desktop.exists() {
        items.push(QuickPathItem {
            name: "Desktop".to_string(),
            path: desktop.to_string_lossy().replace('\\', "/"),
            kind: "desktop".to_string(),
        });
    }

    let docs = home_path.join("Documents");
    if docs.exists() {
        items.push(QuickPathItem {
            name: "Documents".to_string(),
            path: docs.to_string_lossy().replace('\\', "/"),
            kind: "documents".to_string(),
        });
    }

    let downloads = home_path.join("Downloads");
    if downloads.exists() {
        items.push(QuickPathItem {
            name: "Downloads".to_string(),
            path: downloads.to_string_lossy().replace('\\', "/"),
            kind: "downloads".to_string(),
        });
    }

    // On Windows, discover standard drive letters
    #[cfg(target_os = "windows")]
    {
        for letter in b'C'..=b'Z' {
            let drive_str = format!("{}:/", letter as char);
            if Path::new(&drive_str).exists() {
                items.push(QuickPathItem {
                    name: format!("Drive ({}:)", letter as char),
                    path: drive_str,
                    kind: "drive".to_string(),
                });
            }
        }
    }

    Ok(items)
}

#[tauri::command]
pub async fn search_files_recursive(
    state: tauri::State<'_, AppState>,
    root_path: String,
    query: String,
    max_results: Option<usize>,
    include_hidden: Option<bool>,
) -> Result<Vec<FileMetadata>, String> {
    // Bump generation — any older in-flight search will notice and abort
    let gen = state.search_generation.fetch_add(1, Ordering::SeqCst) + 1;
    let search_gen = state.search_generation.clone();

    tokio::task::spawn_blocking(move || {
        let root = Path::new(&root_path);
        if !root.exists() || !root.is_dir() {
            return Err(format!("Invalid search root: {}", root_path));
        }

        let limit = max_results.unwrap_or(40);
        let show_hidden = include_hidden.unwrap_or(false);
        let query_lower = query.to_lowercase();
        let mut matches = Vec::with_capacity(limit);
        let mut checked: u32 = 0;

        let walker = WalkDir::new(root)
            .max_depth(8)
            .into_iter()
            .filter_entry(|e| {
                let file_name = e.file_name().to_string_lossy();
                if e.file_type().is_dir() {
                    if matches!(
                        file_name.as_ref(),
                        "node_modules" | "target" | "dist" | "build" | ".git" | ".next"
                            | "__pycache__" | ".svn" | ".hg" | "vendor" | ".cache"
                    ) {
                        return false;
                    }
                    if !show_hidden && file_name.starts_with('.') {
                        return false;
                    }
                }
                true
            });

        for entry_res in walker {
            // Check cancellation every 256 entries to avoid overhead
            checked += 1;
            if checked & 0xFF == 0 && search_gen.load(Ordering::Relaxed) != gen {
                return Ok(Vec::new()); // superseded by newer search
            }

            let entry = match entry_res {
                Ok(e) => e,
                Err(_) => continue,
            };

            let file_name_os = entry.file_name().to_string_lossy();
            let file_name_lower = file_name_os.to_lowercase();

            if !query_lower.is_empty() {
                if !matches_query(&file_name_lower, &query_lower) {
                    // Fallback: match against relative path (e.g. "src/utils")
                    let rel = entry.path().strip_prefix(root).unwrap_or(entry.path());
                    let rel_lower = rel.to_string_lossy().to_lowercase();
                    if !matches_query(&rel_lower, &query_lower) {
                        continue;
                    }
                }
            }

            // Build metadata inline from WalkDir entry (avoids double stat)
            let meta = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };

            let is_dir = meta.is_dir();
            let name = file_name_os.to_string();
            let path = entry.path();

            let extension = if is_dir {
                None
            } else {
                path.extension().map(|e| e.to_string_lossy().to_string())
            };

            let (category, is_binary) = detect_category_and_binary(extension.as_deref(), is_dir);
            let is_hidden = check_is_hidden(path, &name);

            let modified_ms = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);

            let size = if is_dir { 0 } else { meta.len() };
            let readonly = meta.permissions().readonly();
            let path_str = path.to_string_lossy().to_string().replace('\\', "/");

            matches.push(FileMetadata {
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
            });

            if matches.len() >= limit {
                break;
            }
        }

        Ok(matches)
    })
    .await
    .map_err(|e| format!("Search task failed: {}", e))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quick_paths() {
        let paths = get_quick_access_paths().unwrap();
        assert!(!paths.is_empty());
        assert_eq!(paths[0].kind, "home");
    }

}
