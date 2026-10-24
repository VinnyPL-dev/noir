mod apps;
mod automations;
mod commands;
mod db;
mod error;
mod flow;
mod hardware;
mod shell;
mod spaces;
mod state;
mod vault;

use tauri::Manager;

use commands::{automations as auto_cmds, command, flow as flow_cmds, orbit, pulse, settings, spaces as space_cmds, system, vault as vault_cmds};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(command::plugin())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;

            app.manage(db::Database::open(data_dir.join("noir.db"))?);
            app.manage(state::MonitorState::new());
            app.manage(state::SessionState::new());
            app.manage(hardware::PulseState::new());
            app.manage(hardware::SensorState::start());
            command::init(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            settings::settings_get_all,
            settings::settings_set,
            settings::settings_delete,
            system::get_system_info,
            system::get_snapshot,
            system::get_storage,
            system::get_session_info,
            system::get_app_info,
            pulse::get_pulse,
            orbit::orbit_list,
            orbit::orbit_scan,
            orbit::orbit_launch,
            orbit::orbit_set_favorite,
            orbit::orbit_set_hidden,
            orbit::orbit_set_category,
            orbit::orbit_set_icon,
            orbit::orbit_rename,
            orbit::orbit_add_custom,
            orbit::orbit_remove,
            flow_cmds::note_list,
            flow_cmds::note_create,
            flow_cmds::note_update,
            flow_cmds::note_set_pinned,
            flow_cmds::note_delete,
            flow_cmds::task_list,
            flow_cmds::task_add,
            flow_cmds::task_update,
            flow_cmds::task_set_done,
            flow_cmds::task_set_pinned,
            flow_cmds::task_delete,
            flow_cmds::task_clear_done,
            flow_cmds::project_list,
            flow_cmds::project_add,
            flow_cmds::project_update,
            flow_cmds::project_set_archived,
            flow_cmds::project_delete,
            flow_cmds::project_open,
            flow_cmds::session_add,
            flow_cmds::session_list,
            flow_cmds::session_delete,
            vault_cmds::vault_roots,
            vault_cmds::vault_list_dir,
            vault_cmds::vault_search,
            vault_cmds::vault_breakdown,
            vault_cmds::vault_duplicates,
            vault_cmds::vault_preview,
            vault_cmds::vault_open,
            vault_cmds::vault_reveal,
            vault_cmds::vault_trash,
            vault_cmds::vault_folder_list,
            vault_cmds::vault_folder_add,
            vault_cmds::vault_folder_remove,
            vault_cmds::vault_recent_list,
            vault_cmds::vault_recent_clear,
            vault_cmds::vault_collection_list,
            vault_cmds::vault_collection_create,
            vault_cmds::vault_collection_rename,
            vault_cmds::vault_collection_delete,
            vault_cmds::vault_collection_items,
            vault_cmds::vault_collection_add,
            vault_cmds::vault_collection_remove,
            space_cmds::spaces_list,
            space_cmds::space_create,
            space_cmds::space_update,
            space_cmds::space_set_layout,
            space_cmds::space_set_prefs,
            space_cmds::space_set_shortcuts,
            space_cmds::space_delete,
            space_cmds::spaces_reorder,
            space_cmds::open_url,
            auto_cmds::automation_list,
            auto_cmds::automation_permissions,
            auto_cmds::automation_create,
            auto_cmds::automation_update,
            auto_cmds::automation_set_enabled,
            auto_cmds::automation_delete,
            auto_cmds::automation_run,
            auto_cmds::automation_run_for_space,
            auto_cmds::automation_log,
            auto_cmds::automation_log_clear,
            command::command_shortcut_get,
            command::command_shortcut_set,
        ])
        .run(tauri::generate_context!())
        .expect("error while running NOIR");
}
