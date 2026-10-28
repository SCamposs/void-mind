#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod codex;
mod connections;
mod knowledge;
mod runtime;

use codex::CodexRuntimeManager;
use runtime::RuntimeManager;
use tauri::Manager;

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(RuntimeManager::default())
        .manage(CodexRuntimeManager::default())
        .manage(std::sync::Arc::new(connections::Connections::default()))
        .invoke_handler(tauri::generate_handler![
            connections::connections_status,
            connections::connection_usage,
            connections::connection_welcome_seen,
            connections::connection_select,
            connections::connection_login,
            connections::connection_login_progress,
            connections::connection_login_cancel,
            connections::connection_api_save,
            connections::connection_disconnect,
            connections::connection_models,
            connections::connection_generate,
            connections::connection_cancel,
            runtime::validate_runtime,
            runtime::start_runtime,
            runtime::runtime_status,
            runtime::stop_runtime,
            codex::codex_status,
            codex::codex_start,
            codex::codex_stop,
            codex::codex_account,
            codex::codex_login_start,
            codex::codex_login_cancel,
            codex::codex_logout,
            codex::codex_models,
            codex::codex_thread_start,
            codex::codex_thread_resume,
            codex::codex_turn_start,
            codex::codex_turn_interrupt,
            codex::open_codex_auth_url,
            knowledge::import_knowledge_file,
            knowledge::delete_knowledge_file,
        ])
        .build(tauri::generate_context!())
        .expect("error while building VOID Mind");

    app.run(|handle, event| {
        if matches!(
            event,
            tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. }
        ) {
            handle.state::<RuntimeManager>().stop_for_shutdown();
            handle.state::<CodexRuntimeManager>().stop_for_shutdown();
        }
    });
}
