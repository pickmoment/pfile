use std::path::Path;
use std::time::Duration;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use notify_debouncer_mini::{new_debouncer, notify::RecursiveMode};
use crate::state::AppState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WatcherEvent {
    pub paths: Vec<String>,
}

#[tauri::command]
pub fn start_watch(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<(), String> {
    let watch_path = Path::new(&path);
    if !watch_path.exists() {
        return Err(format!("Watch path does not exist: {}", path));
    }

    // Stop existing watcher
    {
        let mut watcher_guard = state.watcher.lock().map_err(|e| e.to_string())?;
        *watcher_guard = None;
    }

    let app_handle = app.clone();
    let mut debouncer = new_debouncer(
        Duration::from_millis(200),
        move |res: notify_debouncer_mini::DebounceEventResult| {
            match res {
                Ok(events) => {
                    let changed_paths: Vec<String> = events
                        .into_iter()
                        .map(|e| e.path.to_string_lossy().to_string().replace('\\', "/"))
                        .collect();

                    if !changed_paths.is_empty() {
                        let _ = app_handle.emit(
                            "file-watcher-event",
                            WatcherEvent {
                                paths: changed_paths,
                            },
                        );
                    }
                }
                Err(err) => {
                    eprintln!("File watcher error: {:?}", err);
                }
            }
        },
    )
    .map_err(|e| format!("Failed to create file watcher: {}", e))?;

    debouncer
        .watcher()
        .watch(watch_path, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to start watching path {:?}: {}", watch_path, e))?;

    // Store active watcher and path
    {
        let mut watcher_guard = state.watcher.lock().map_err(|e| e.to_string())?;
        *watcher_guard = Some(debouncer);
    }
    {
        let mut path_guard = state.current_watched_path.lock().map_err(|e| e.to_string())?;
        *path_guard = Some(path);
    }

    Ok(())
}

#[tauri::command]
pub fn stop_watch(state: State<'_, AppState>) -> Result<(), String> {
    let mut watcher_guard = state.watcher.lock().map_err(|e| e.to_string())?;
    *watcher_guard = None;

    let mut path_guard = state.current_watched_path.lock().map_err(|e| e.to_string())?;
    *path_guard = None;

    Ok(())
}
