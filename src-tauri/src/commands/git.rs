use git2::{
    build::CheckoutBuilder, BranchType, Delta, Diff, DiffOptions, ErrorCode, ObjectType,
    Repository, Signature, Sort, Status, StatusOptions, StatusShow,
};
use serde::{Deserialize, Serialize};
use std::{path::Path, process::Command};

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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitCommitFile {
    pub path: String,
    pub old_path: Option<String>,
    pub status: GitFileStatusKind,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitCommitDetail {
    pub id: String,
    pub short_id: String,
    pub summary: String,
    pub message: String,
    pub author: String,
    pub email: String,
    pub timestamp: i64,
    pub parent_ids: Vec<String>,
    pub additions: usize,
    pub deletions: usize,
    pub files: Vec<GitCommitFile>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitBranchInfo {
    pub name: String,
    pub current: bool,
    pub upstream: Option<String>,
}

// ── Helpers ─────────────────────────────────────────────────────

fn open_repo(path: &str) -> Result<Repository, String> {
    Repository::discover(path).map_err(|e| format!("Not a git repository: {}", e))
}

fn current_branch_name(repo: &Repository) -> Result<String, String> {
    let head = repo
        .head()
        .map_err(|e| format!("Cannot read HEAD: {}", e))?;
    if !head.is_branch() {
        return Err("Cannot operate on branches while HEAD is detached".to_string());
    }
    head.shorthand()
        .map(str::to_string)
        .ok_or_else(|| "Current branch has no valid name".to_string())
}

fn ensure_clean(repo: &Repository) -> Result<(), String> {
    let mut options = StatusOptions::new();
    options
        .include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false)
        .show(StatusShow::IndexAndWorkdir);
    let statuses = repo
        .statuses(Some(&mut options))
        .map_err(|e| e.to_string())?;
    if statuses.is_empty() {
        Ok(())
    } else {
        Err(
            "Commit, stash, or discard local changes before switching branches or pulling"
                .to_string(),
        )
    }
}

fn checkout_local_branch(repo: &Repository, name: &str) -> Result<(), String> {
    ensure_clean(repo)?;
    let branch = repo
        .find_branch(name, BranchType::Local)
        .map_err(|_| format!("Local branch '{}' does not exist", name))?;
    let object = branch
        .get()
        .peel(ObjectType::Commit)
        .map_err(|e| e.to_string())?;
    repo.checkout_tree(&object, Some(CheckoutBuilder::new().safe()))
        .map_err(|e| format!("Checkout failed: {}", e))?;
    let reference_name = branch
        .get()
        .name()
        .ok_or("Branch reference is not valid UTF-8")?;
    repo.set_head(reference_name)
        .map_err(|e| format!("Failed to update HEAD: {}", e))?;
    Ok(())
}

fn run_git_network(repo: &Repository, args: &[&str], operation: &str) -> Result<String, String> {
    let workdir = repo.workdir().ok_or("Bare repository")?;
    let output = Command::new("git")
        .arg("-C")
        .arg(workdir)
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::NotFound {
                "Git executable was not found. Pull and Push require the system Git installation to honor local Git and SSH configuration".to_string()
            } else {
                format!("Failed to start Git for {}: {}", operation, error)
            }
        })?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if output.status.success() {
        if !stdout.is_empty() {
            Ok(stdout)
        } else if !stderr.is_empty() {
            Ok(stderr)
        } else {
            Ok(format!("{} completed", operation))
        }
    } else {
        let detail = if !stderr.is_empty() { stderr } else { stdout };
        Err(format!(
            "{} failed using the repository's local Git configuration: {}",
            operation,
            if detail.is_empty() {
                "unknown Git error"
            } else {
                &detail
            }
        ))
    }
}

fn upstream_target(repo: &Repository, branch_name: &str) -> Result<(String, String, bool), String> {
    let branch = repo
        .find_branch(branch_name, BranchType::Local)
        .map_err(|e| e.to_string())?;
    if let Ok(upstream) = branch.upstream() {
        let shorthand = upstream
            .name()
            .map_err(|e| e.to_string())?
            .ok_or("Upstream branch name is not valid UTF-8")?;
        if let Some((remote, remote_branch)) = shorthand.split_once('/') {
            return Ok((remote.to_string(), remote_branch.to_string(), true));
        }
    }
    let config = repo.config().map_err(|e| e.to_string())?;
    let branch_push_remote = format!("branch.{}.pushRemote", branch_name);
    let branch_remote = format!("branch.{}.remote", branch_name);
    for key in [
        branch_push_remote.as_str(),
        "remote.pushDefault",
        branch_remote.as_str(),
    ] {
        if let Ok(remote) = config.get_string(key) {
            if !remote.is_empty() && remote != "." {
                return Ok((remote, branch_name.to_string(), false));
            }
        }
    }
    Ok(("origin".to_string(), branch_name.to_string(), false))
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
        Some(name) => name,
        None => return (0, 0),
    };
    let upstream_oid = match repo
        .find_branch(branch_name, BranchType::Local)
        .and_then(|branch| branch.upstream())
        .ok()
        .and_then(|upstream| upstream.get().target())
    {
        Some(oid) => oid,
        None => return (0, 0),
    };
    repo.graph_ahead_behind(local_oid, upstream_oid)
        .map(|(a, b)| (a as u32, b as u32))
        .unwrap_or((0, 0))
}

fn delta_status(status: Delta) -> GitFileStatusKind {
    match status {
        Delta::Added => GitFileStatusKind::Added,
        Delta::Deleted => GitFileStatusKind::Deleted,
        Delta::Renamed => GitFileStatusKind::Renamed,
        Delta::Typechange => GitFileStatusKind::Typechange,
        Delta::Conflicted => GitFileStatusKind::Conflicted,
        _ => GitFileStatusKind::Modified,
    }
}

fn format_patch(diff: &Diff<'_>) -> Result<String, String> {
    let mut result = String::new();
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        match line.origin() {
            '+' | '-' | ' ' => result.push(line.origin()),
            _ => {}
        }
        if let Ok(content) = std::str::from_utf8(line.content()) {
            result.push_str(content);
        }
        true
    })
    .map_err(|e| e.to_string())?;
    Ok(result)
}

// ── Commands ────────────────────────────────────────────────────

#[tauri::command]
pub async fn git_repo_info(path: String) -> GitRepoInfo {
    match tokio::task::spawn_blocking(move || git_repo_info_blocking(path)).await {
        Ok(info) => info,
        Err(_) => GitRepoInfo {
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
        },
    }
}

fn git_repo_info_blocking(path: String) -> GitRepoInfo {
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
                (head.shorthand().map(|s| s.to_string()), false)
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
pub fn git_branches(path: String) -> Result<Vec<GitBranchInfo>, String> {
    let repo = open_repo(&path)?;
    let mut result = Vec::new();
    let branches = repo
        .branches(Some(BranchType::Local))
        .map_err(|e| e.to_string())?;

    for item in branches {
        let (branch, _) = item.map_err(|e| e.to_string())?;
        let name = branch
            .name()
            .map_err(|e| e.to_string())?
            .ok_or("Branch name is not valid UTF-8")?
            .to_string();
        let upstream = branch
            .upstream()
            .ok()
            .and_then(|upstream| upstream.name().ok().flatten().map(str::to_string));
        result.push(GitBranchInfo {
            name,
            current: branch.is_head(),
            upstream,
        });
    }

    result.sort_by(|left, right| {
        right
            .current
            .cmp(&left.current)
            .then(left.name.cmp(&right.name))
    });
    Ok(result)
}

#[tauri::command]
pub fn git_create_branch(path: String, name: String) -> Result<(), String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Branch name cannot be empty".to_string());
    }
    let repo = open_repo(&path)?;
    ensure_clean(&repo)?;
    let head = repo
        .head()
        .and_then(|reference| reference.peel_to_commit())
        .map_err(|e| format!("Cannot create a branch without a commit: {}", e))?;
    repo.branch(trimmed, &head, false)
        .map_err(|e| format!("Failed to create branch: {}", e))?;
    if let Err(error) = checkout_local_branch(&repo, trimmed) {
        if let Ok(mut branch) = repo.find_branch(trimmed, BranchType::Local) {
            let _ = branch.delete();
        }
        return Err(error);
    }
    Ok(())
}

#[tauri::command]
pub fn git_checkout_branch(path: String, name: String) -> Result<(), String> {
    let repo = open_repo(&path)?;
    checkout_local_branch(&repo, &name)
}

#[tauri::command]
pub fn git_delete_branch(path: String, name: String) -> Result<(), String> {
    let repo = open_repo(&path)?;
    if current_branch_name(&repo)? == name {
        return Err("Cannot delete the current branch".to_string());
    }
    let mut branch = repo
        .find_branch(&name, BranchType::Local)
        .map_err(|_| format!("Local branch '{}' does not exist", name))?;
    let branch_oid = branch
        .get()
        .target()
        .ok_or("Branch does not point to a commit")?;
    let head_oid = repo
        .head()
        .ok()
        .and_then(|head| head.target())
        .ok_or("Current HEAD does not point to a commit")?;
    if head_oid != branch_oid
        && !repo
            .graph_descendant_of(head_oid, branch_oid)
            .map_err(|e| e.to_string())?
    {
        return Err(format!("Branch '{}' is not fully merged", name));
    }
    branch
        .delete()
        .map_err(|e| format!("Failed to delete branch: {}", e))
}

#[tauri::command]
pub fn git_pull(path: String) -> Result<String, String> {
    let repo = open_repo(&path)?;
    ensure_clean(&repo)?;
    current_branch_name(&repo)?;
    run_git_network(&repo, &["pull", "--ff-only"], "Pull")
}

#[tauri::command]
pub fn git_push(path: String) -> Result<String, String> {
    let repo = open_repo(&path)?;
    let branch_name = current_branch_name(&repo)?;
    let (remote_name, remote_branch, had_upstream) = upstream_target(&repo, &branch_name)?;
    if had_upstream {
        run_git_network(&repo, &["push"], "Push")
    } else {
        let refspec = if remote_branch == branch_name {
            branch_name.clone()
        } else {
            format!("{}:{}", branch_name, remote_branch)
        };
        run_git_network(
            &repo,
            &["push", "--set-upstream", &remote_name, &refspec],
            "Push",
        )
    }
}
#[tauri::command]
pub fn git_stage(path: String, files: Vec<String>) -> Result<(), String> {
    let repo = open_repo(&path)?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    let workdir = repo.workdir().ok_or("Bare repository")?;

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
    let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());

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
pub fn git_diff(path: String, file_path: String, staged: bool) -> Result<String, String> {
    let repo = open_repo(&path)?;
    let workdir = repo.workdir().ok_or("Bare repository")?;

    let rel = if Path::new(&file_path).is_absolute() {
        pathdiff(&file_path, &workdir.to_string_lossy())
    } else {
        file_path
    };

    let mut opts = DiffOptions::new();
    opts.pathspec(&rel);

    let diff = if staged {
        let head_tree = repo.head().ok().and_then(|head| head.peel_to_tree().ok());
        repo.diff_tree_to_index(head_tree.as_ref(), None, Some(&mut opts))
            .map_err(|e| e.to_string())?
    } else {
        opts.include_untracked(true)
            .recurse_untracked_dirs(true)
            .show_untracked_content(true);
        repo.diff_index_to_workdir(None, Some(&mut opts))
            .map_err(|e| e.to_string())?
    };

    format_patch(&diff)
}

#[tauri::command]
pub fn git_commit_detail(path: String, commit_id: String) -> Result<GitCommitDetail, String> {
    let repo = open_repo(&path)?;
    let commit = repo
        .revparse_single(&commit_id)
        .and_then(|object| object.peel_to_commit())
        .map_err(|e| format!("Commit not found: {}", e))?;
    let tree = commit.tree().map_err(|e| e.to_string())?;
    let parent_tree = if commit.parent_count() > 0 {
        Some(
            commit
                .parent(0)
                .and_then(|parent| parent.tree())
                .map_err(|e| e.to_string())?,
        )
    } else {
        None
    };
    let diff = repo
        .diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), None)
        .map_err(|e| e.to_string())?;
    let stats = diff.stats().map_err(|e| e.to_string())?;

    let files = diff
        .deltas()
        .map(|delta| {
            let old_path = delta
                .old_file()
                .path()
                .map(|path| path.to_string_lossy().to_string());
            let new_path = delta
                .new_file()
                .path()
                .map(|path| path.to_string_lossy().to_string());
            let path = new_path
                .clone()
                .or_else(|| old_path.clone())
                .unwrap_or_default();
            let renamed_from = if old_path.as_ref() != Some(&path) {
                old_path
            } else {
                None
            };
            GitCommitFile {
                path,
                old_path: renamed_from,
                status: delta_status(delta.status()),
            }
        })
        .collect();

    let id = commit.id().to_string();
    let author_signature = commit.author();
    let author = author_signature.name().unwrap_or("").to_string();
    let email = author_signature.email().unwrap_or("").to_string();
    let summary = commit.summary().unwrap_or("").to_string();
    let message = commit.message().unwrap_or("").trim_end().to_string();
    Ok(GitCommitDetail {
        short_id: id[..7].to_string(),
        id,
        summary,
        message,
        author,
        email,
        timestamp: commit.time().seconds(),
        parent_ids: commit
            .parent_ids()
            .map(|parent| parent.to_string())
            .collect(),
        additions: stats.insertions(),
        deletions: stats.deletions(),
        files,
    })
}

#[tauri::command]
pub fn git_commit_diff(
    path: String,
    commit_id: String,
    file_path: Option<String>,
) -> Result<String, String> {
    let repo = open_repo(&path)?;
    let commit = repo
        .revparse_single(&commit_id)
        .and_then(|object| object.peel_to_commit())
        .map_err(|e| format!("Commit not found: {}", e))?;
    let tree = commit.tree().map_err(|e| e.to_string())?;
    let parent_tree = if commit.parent_count() > 0 {
        Some(
            commit
                .parent(0)
                .and_then(|parent| parent.tree())
                .map_err(|e| e.to_string())?,
        )
    } else {
        None
    };

    let mut opts = DiffOptions::new();
    if let Some(file_path) = file_path {
        opts.pathspec(file_path);
    }
    let diff = repo
        .diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), Some(&mut opts))
        .map_err(|e| e.to_string())?;
    format_patch(&diff)
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
            let obj = head
                .peel(git2::ObjectType::Commit)
                .map_err(|e| e.to_string())?;
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
