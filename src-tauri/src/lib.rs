pub mod commands;
pub mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::fs_ops::list_directory,
            commands::fs_ops::read_file_text,
            commands::fs_ops::read_file_binary_base64,
            commands::fs_ops::write_file_text,
            commands::fs_ops::create_file,
            commands::fs_ops::create_directory,
            commands::fs_ops::rename_item,
            commands::fs_ops::copy_items,
            commands::fs_ops::move_items,
            commands::fs_ops::delete_items,
            commands::tokens::calculate_tokens,
            commands::watcher::start_watch,
            commands::watcher::stop_watch,
            commands::system::show_in_file_manager,
            commands::system::open_in_default_app,
            commands::system::get_home_dir,
            commands::system::get_quick_access_paths,
            commands::system::search_files_recursive,
            commands::git::git_repo_info,
            commands::git::git_stage,
            commands::git::git_unstage,
            commands::git::git_commit,
            commands::git::git_discard,
            commands::git::git_diff,
            commands::git::git_log,
            commands::git::git_stage_all,
            commands::git::git_unstage_all,
            commands::archive::archive_list,
            commands::archive::archive_extract_file,
            commands::archive::archive_extract_to,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
