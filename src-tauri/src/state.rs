use std::sync::{atomic::AtomicU64, Arc, Mutex};
use notify_debouncer_mini::Debouncer;
use notify::RecommendedWatcher;

pub struct AppState {
    pub watcher: Mutex<Option<Debouncer<RecommendedWatcher>>>,
    pub current_watched_path: Mutex<Option<String>>,
    pub search_generation: Arc<AtomicU64>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            watcher: Mutex::new(None),
            current_watched_path: Mutex::new(None),
            search_generation: Arc::new(AtomicU64::new(0)),
        }
    }
}
