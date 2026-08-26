use git2::{
    DiffOptions, ErrorCode, Repository, Signature, Sort, Status, StatusOptions, StatusShow,
};
use serde::{Deserialize, Serialize};
use std::path::Path;

// ── Types ───────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum GitFileStatusKind {
    Modified,
    Added,
    Deleted,
    Renamed,
    Typechange,
    Untracked,
    Ignored,
    Conflicted,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitFileStatus {
    /// Path relative to repo root
    pub path: String,
    /// Absolute path
    pub abs_path: String,
    pub index_status: Option<GitFileStatusKind>,
    pub worktree_status: Option<GitFileStatusKind>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitRepoInfo {
    pub is_repo: bool,
    pub repo_root: Option<String>,
    pub branch: Option<String>,
    pub is_detached: bool,
    pub ahead: u32,
    pub behind: u32,
    pub files: Vec<GitFileStatus>,
    pub staged_count: u32,
    pub modified_count: u32,
    pub untracked_count: u32,
    pub conflicted_count: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitLogEntry {
    pub id: String,
    pub short_id: String,
    pub summary: String,
    pub author: String,
    pub email: String,
    pub timestamp: i64,
    pub relative_time: String,
}

// ── Helpers ─────────────────────────────────────────────────────

fn open_repo(path: &str) -> Result<Repository, String> {
    Repository::discover(path).map_err(|e| format!("Not a git repository: {}", e))
}

fn map_index_status(s: Status) -> Option<GitFileStatusKind> {
    if s.contains(Status::INDEX_NEW) {
        Some(GitFileStatusKind::Added)
    } else if s.contains(Status::INDEX_MODIFIED) {
        Some(GitFileStatusKind::Modified)
    } else if s.contains(Status::INDEX_DELETED) {
        Some(GitFileStatusKind::Deleted)
    } else if s.contains(Status::INDEX_RENAMED) {
        Some(GitFileStatusKind::Renamed)
    } else if s.contains(Status::INDEX_TYPECHANGE) {
        Some(GitFileStatusKind::Typechange)
    } else {
        None
    }
}

fn map_worktree_status(s: Status) -> Option<GitFileStatusKind> {
    if s.is_conflicted() {
        Some(GitFileStatusKind::Conflicted)
    } else if s.contains(Status::WT_NEW) {
        Some(GitFileStatusKind::Untracked)
    } else if s.contains(Status::WT_MODIFIED) {
        Some(GitFileStatusKind::Modified)
    } else if s.contains(Status::WT_DELETED) {
        Some(GitFileStatusKind::Deleted)
    } else if s.contains(Status::WT_RENAMED) {
        Some(GitFileStatusKind::Renamed)
    } else if s.contains(Status::WT_TYPECHANGE) {
        Some(GitFileStatusKind::Typechange)
    } else {
        None
    }
}

fn relative_time(secs_ago: i64) -> String {
    if secs_ago < 60 {
        "just now".to_string()
    } else if secs_ago < 3600 {
        format!("{} min ago", secs_ago / 60)
    } else if secs_ago < 86400 {
        format!("{} hours ago", secs_ago / 3600)
    } else if secs_ago < 604800 {
        format!("{} days ago", secs_ago / 86400)
    } else if secs_ago < 2592000 {
        format!("{} weeks ago", secs_ago / 604800)
    } else {
        format!("{} months ago", secs_ago / 2592000)
    }
}

fn ahead_behind(repo: &Repository) -> (u32, u32) {
    let head = match repo.head() {
        Ok(h) => h,
        Err(_) => return (0, 0),
    };
    let local_oid = match head.target() {
        Some(o) => o,
        None => return (0, 0),
    };
    let branch_name = match head.shorthand() {
        Some(n) => n.to_string(),
        None => return (0, 0),
    };
    let upstream_name = format!("refs/remotes/origin/{}", branch_name);
    let upstream_ref = match repo.find_reference(&upstream_name) {
        Ok(r) => r,
        Err(_) => return (0, 0),
    };
    let upstream_oid = match upstream_ref.target() {
        Some(o) => o,
        None => return (0, 0),
    };
    repo.graph_ahead_behind(local_oid, upstream_oid)
        .map(|(a, b)| (a as u32, b as u32))
        .unwrap_or((0, 0))
}

// ── Commands ────────────────────────────────────────────────────

#[tauri::command]
pub fn git_repo_info(path: String) -> GitRepoInfo {
    let repo = match open_repo(&path) {
        Ok(r) => r,
        Err(_) => {
            return GitRepoInfo {
                is_repo: false,
                repo_root: None,
                branch: None,
                is_detached: false,
                ahead: 0,
                behind: 0,
                files: vec![],
                staged_count: 0,
                modified_count: 0,
                untracked_count: 0,
                conflicted_count: 0,
            }
        }
    };

    let repo_root = repo
        .workdir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    let (branch, is_detached) = match repo.head() {
        Ok(head) => {
            if head.is_branch() {
                (
                    head.shorthand().map(|s| s.to_string()),
                    false,
                )
            } else {
                // Detached HEAD — show short oid
                let short = head
                    .target()
                    .map(|oid| format!("{}", &oid.to_string()[..7]));
                (short, true)
            }
        }
        Err(_) => (None, false), // Brand new repo with no commits
    };

    let (ahead, behind) = ahead_behind(&repo);

    // Collect file statuses
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false)
        .show(StatusShow::IndexAndWorkdir);

    let statuses = match repo.statuses(Some(&mut opts)) {
        Ok(s) => s,
        Err(_) => {
            return GitRepoInfo {
                is_repo: true,
                repo_root: Some(repo_root),
                branch,
                is_detached,
                ahead,
                behind,
                files: vec![],
                staged_count: 0,
                modified_count: 0,
                untracked_count: 0,
                conflicted_count: 0,
            }
        }
    };

    let mut files = Vec::new();
    let mut staged_count = 0u32;
    let mut modified_count = 0u32;
    let mut untracked_count = 0u32;
    let mut conflicted_count = 0u32;

    let workdir = repo.workdir().unwrap_or(Path::new(""));

    for entry in statuses.iter() {
        let rel_path = entry.path().unwrap_or("").to_string();
        let abs_path = workdir.join(&rel_path).to_string_lossy().to_string();
        let status = entry.status();

        let index_status = map_index_status(status);
        let worktree_status = map_worktree_status(status);

        if index_status.is_some() {
            staged_count += 1;
        }
        match &worktree_status {
            Some(GitFileStatusKind::Modified) => modified_count += 1,
            Some(GitFileStatusKind::Untracked) => untracked_count += 1,
            Some(GitFileStatusKind::Conflicted) => conflicted_count += 1,
            _ => {}
        }

        files.push(GitFileStatus {
            path: rel_path,
            abs_path,
            index_status,
            worktree_status,
        });
    }

    GitRepoInfo {
        is_repo: true,
        repo_root: Some(repo_root),
        branch,
        is_detached,
        ahead,
        behind,
        files,
        staged_count,
        modified_count,
        untracked_count,
        conflicted_count,
    }
}

#[tauri::command]
pub fn git_stage(path: String, files: Vec<String>) -> Result<(), String> {
    let repo = open_repo(&path)?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    let workdir = repo
        .workdir()
        .ok_or("Bare repository")?;

    for file_path in &files {
        let rel = if Path::new(file_path).is_absolute() {
            pathdiff(file_path, &workdir.to_string_lossy())
        } else {
            file_path.clone()
        };

        let abs = workdir.join(&rel);
        if abs.exists() {
            index
                .add_path(Path::new(&rel))
                .map_err(|e| format!("Failed to stage {}: {}", rel, e))?;
        } else {
            // File was deleted — stage the removal
            index
                .remove_path(Path::new(&rel))
                .map_err(|e| format!("Failed to stage deletion {}: {}", rel, e))?;
        }
    }
    index.write().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_unstage(path: String, files: Vec<String>) -> Result<(), String> {
    let repo = open_repo(&path)?;
    let workdir = repo.workdir().ok_or("Bare repository")?;

    // Get HEAD tree (may not exist on first commit)
    let head_tree = repo
        .head()
        .ok()
        .and_then(|h| h.peel_to_tree().ok());

    let mut index = repo.index().map_err(|e| e.to_string())?;

    for file_path in &files {
        let rel = if Path::new(file_path).is_absolute() {
            pathdiff(file_path, &workdir.to_string_lossy())
        } else {
            file_path.clone()
        };

        if let Some(ref tree) = head_tree {
            // Reset to HEAD version
            match tree.get_path(Path::new(&rel)) {
                Ok(entry) => {
                    index
                        .add(&git2::IndexEntry {
                            ctime: git2::IndexTime::new(0, 0),
                            mtime: git2::IndexTime::new(0, 0),
                            dev: 0,
                            ino: 0,
                            mode: entry.filemode() as u32,
                            uid: 0,
                            gid: 0,
                            file_size: 0,
                            id: entry.id(),
                            flags: 0,
                            flags_extended: 0,
                            path: rel.as_bytes().to_vec(),
                        })
                        .map_err(|e| e.to_string())?;
                }
                Err(_) => {
                    // File doesn't exist in HEAD — remove from index
                    let _ = index.remove_path(Path::new(&rel));
                }
            }
        } else {
            // No HEAD (initial commit) — remove from index
            let _ = index.remove_path(Path::new(&rel));
        }
    }
    index.write().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_commit(path: String, message: String) -> Result<String, String> {
    let repo = open_repo(&path)?;
    let sig = repo
        .signature()
        .or_else(|_| Signature::now("pfile", "pfile@local"))
        .map_err(|e| format!("Cannot create signature: {}", e))?;

    let mut index = repo.index().map_err(|e| e.to_string())?;
    let tree_oid = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_oid).map_err(|e| e.to_string())?;

    let head_result = repo.head();
    let parent = match &head_result {
        Ok(head) => {
            let commit = head.peel_to_commit().map_err(|e| e.to_string())?;
            Some(commit)
        }
        Err(e) if e.code() == ErrorCode::UnbornBranch => None,
        Err(e) => return Err(e.to_string()),
    };

    let parents: Vec<&git2::Commit> = parent.iter().collect();

    let oid = repo
        .commit(Some("HEAD"), &sig, &sig, &message, &tree, &parents)
        .map_err(|e| e.to_string())?;

    Ok(oid.to_string()[..7].to_string())
}

#[tauri::command]
pub fn git_discard(path: String, files: Vec<String>) -> Result<(), String> {
    let repo = open_repo(&path)?;
    let workdir = repo.workdir().ok_or("Bare repository")?;

    let mut checkout_builder = git2::build::CheckoutBuilder::new();
    checkout_builder.force();

    for file_path in &files {
        let rel = if Path::new(file_path).is_absolute() {
            pathdiff(file_path, &workdir.to_string_lossy())
        } else {
            file_path.clone()
        };
        checkout_builder.path(&rel);
    }

    repo.checkout_head(Some(&mut checkout_builder))
        .map_err(|e| format!("Discard failed: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn git_diff(path: String, file_path: String) -> Result<String, String> {
    let repo = open_repo(&path)?;
    let workdir = repo.workdir().ok_or("Bare repository")?;

    let rel = if Path::new(&file_path).is_absolute() {
        pathdiff(&file_path, &workdir.to_string_lossy())
    } else {
        file_path.clone()
    };

    let mut opts = DiffOptions::new();
    opts.pathspec(&rel);

    // Diff working directory vs index
    let diff = repo
        .diff_index_to_workdir(None, Some(&mut opts))
        .map_err(|e| e.to_string())?;

    let mut result = String::new();
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        let prefix = match line.origin() {
            '+' => "+",
            '-' => "-",
            ' ' => " ",
            _ => "",
        };
        result.push_str(prefix);
        if let Ok(content) = std::str::from_utf8(line.content()) {
            result.push_str(content);
        }
        true
    })
    .map_err(|e| e.to_string())?;

    // If empty, try staged diff (index vs HEAD)
    if result.is_empty() {
        let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());
        let diff = repo
            .diff_tree_to_index(head_tree.as_ref(), None, Some(&mut opts))
            .map_err(|e| e.to_string())?;

        diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
            let prefix = match line.origin() {
                '+' => "+",
                '-' => "-",
                ' ' => " ",
                _ => "",
            };
            result.push_str(prefix);
            if let Ok(content) = std::str::from_utf8(line.content()) {
                result.push_str(content);
            }
            true
        })
        .map_err(|e| e.to_string())?;
    }

    Ok(result)
}

#[tauri::command]
pub fn git_log(path: String, count: Option<u32>) -> Result<Vec<GitLogEntry>, String> {
    let repo = open_repo(&path)?;
    let limit = count.unwrap_or(50) as usize;

    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push_head().map_err(|e| e.to_string())?;
    revwalk.set_sorting(Sort::TIME).map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().timestamp();
    let mut entries = Vec::new();

    for oid_result in revwalk.take(limit) {
        let oid = oid_result.map_err(|e| e.to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
        let full_id = oid.to_string();
        let short_id = full_id[..7].to_string();
        let ts = commit.time().seconds();
        let ago = now - ts;

        entries.push(GitLogEntry {
            id: full_id,
            short_id,
            summary: commit.summary().unwrap_or("").to_string(),
            author: commit.author().name().unwrap_or("").to_string(),
            email: commit.author().email().unwrap_or("").to_string(),
            timestamp: ts,
            relative_time: relative_time(ago),
        });
    }

    Ok(entries)
}

#[tauri::command]
pub fn git_stage_all(path: String) -> Result<(), String> {
    let repo = open_repo(&path)?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index
        .add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| e.to_string())?;

    // Also handle deleted files
    index
        .update_all(["*"].iter(), None)
        .map_err(|e| e.to_string())?;

    index.write().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn git_unstage_all(path: String) -> Result<(), String> {
    let repo = open_repo(&path)?;
    let head_result = repo.head();
    match &head_result {
        Ok(head) => {
            let obj = head.peel(git2::ObjectType::Commit).map_err(|e| e.to_string())?;
            repo.reset_default(Some(&obj), ["*"].iter())
                .map_err(|e| e.to_string())?;
        }
        Err(e) if e.code() == ErrorCode::UnbornBranch => {
            // No commits yet — just remove everything from index
            let mut index = repo.index().map_err(|e| e.to_string())?;
            index.clear().map_err(|e| e.to_string())?;
            index.write().map_err(|e| e.to_string())?;
        }
        Err(e) => return Err(e.to_string()),
    }

    Ok(())
}

// ── Utility ─────────────────────────────────────────────────────

/// Simple relative-path computation: target relative to base.
fn pathdiff(target: &str, base: &str) -> String {
    let target = Path::new(target);
    let base = Path::new(base);
    target
        .strip_prefix(base)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| target.to_string_lossy().to_string())
}
