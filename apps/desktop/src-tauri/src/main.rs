#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod runtime;

use runtime::RuntimeManager;
use tauri::Manager;

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(RuntimeManager::default())
        .invoke_handler(tauri::generate_handler![
            runtime::validate_runtime,
            runtime::start_runtime,
            runtime::runtime_status,
            runtime::stop_runtime,
        ])
        .build(tauri::generate_context!())
        .expect("error while building VOID Mind");

    app.run(|handle, event| {
        if matches!(
            event,
            tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. }
        ) {
            handle.state::<RuntimeManager>().stop_for_shutdown();
        }
    });
}
