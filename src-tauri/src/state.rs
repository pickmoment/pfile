use std::sync::Mutex;
use notify_debouncer_mini::Debouncer;
use notify::RecommendedWatcher;

pub struct AppState {
    pub watcher: Mutex<Option<Debouncer<RecommendedWatcher>>>,
    pub current_watched_path: Mutex<Option<String>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            watcher: Mutex::new(None),
            current_watched_path: Mutex::new(None),
        }
    }
}
