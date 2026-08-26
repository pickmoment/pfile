use std::path::{Path, PathBuf};
use std::process::Command;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;
use crate::commands::fs_ops::{get_file_metadata, FileMetadata};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuickPathItem {
    pub name: String,
    pub path: String,
    pub kind: String,
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
pub fn search_files_recursive(
    root_path: String,
    query: String,
    max_results: Option<usize>,
    include_hidden: Option<bool>,
) -> Result<Vec<FileMetadata>, String> {
    let root = Path::new(&root_path);
    if !root.exists() || !root.is_dir() {
        return Err(format!("Invalid search root: {}", root_path));
    }

    let limit = max_results.unwrap_or(40);
    let show_hidden = include_hidden.unwrap_or(false);
    let query_lower = query.to_lowercase();
    let mut matches = Vec::new();

    let walker = WalkDir::new(root)
        .max_depth(8)
        .into_iter()
        .filter_entry(|e| {
            let file_name = e.file_name().to_string_lossy();
            // Always skip heavy generated folders
            if e.file_type().is_dir() {
                if file_name == "node_modules"
                    || file_name == "target"
                    || file_name == "dist"
                    || file_name == "build"
                    || file_name == ".git"
                    || file_name == ".next"
                {
                    return false;
                }
                if !show_hidden && file_name.starts_with('.') {
                    return false;
                }
            }
            true
        });
    for entry_res in walker {
        if let Ok(entry) = entry_res {
            let file_name = entry.file_name().to_string_lossy().to_lowercase();
            if query_lower.is_empty() || file_name.contains(&query_lower) {
                if let Ok(meta) = get_file_metadata(entry.path()) {
                    matches.push(meta);
                    if matches.len() >= limit {
                        break;
                    }
                }
            }
        }
    }

    Ok(matches)
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

    #[test]
    fn test_recursive_search() {
        let temp_dir = std::env::temp_dir();
        let res = search_files_recursive(temp_dir.to_string_lossy().to_string(), "".to_string(), Some(5), Some(true)).unwrap();
        assert!(res.len() <= 5);
    }
}
