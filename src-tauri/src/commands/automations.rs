use tauri::State;

use crate::automations::{self, Action, Automation, LogEntry, Permissions, RunReport};
use crate::db::Database;
use crate::error::AppError;

#[tauri::command]
pub fn automation_list(db: State<'_, Database>) -> Result<Vec<Automation>, AppError> {
    db.with(automations::list)
}
#[tauri::command]
pub fn automation_permissions(db: State<'_, Database>) -> Result<Permissions, AppError> {
    db.with(automations::permissions)
}
#[tauri::command]
pub fn automation_create(db: State<'_, Database>, name: String, space_id: String, actions: Vec<Action>) -> Result<Automation, AppError> {
    db.with(|c| automations::create(c, &name, &space_id, &actions))
}
#[tauri::command]
pub fn automation_update(db: State<'_, Database>, id: String, name: String, space_id: String, actions: Vec<Action>) -> Result<Automation, AppError> {
    db.with(|c| automations::update(c, &id, &name, &space_id, &actions))
}
#[tauri::command]
pub fn automation_set_enabled(db: State<'_, Database>, id: String, enabled: bool) -> Result<(), AppError> {
    db.with(|c| automations::set_enabled(c, &id, enabled))
}
#[tauri::command]
pub fn automation_delete(db: State<'_, Database>, id: String) -> Result<(), AppError> {
    db.with(|c| automations::delete(c, &id))
}

/// "Run now": always user-initiated. Action-type permissions still apply.
#[tauri::command(async)]
pub fn automation_run(db: State<'_, Database>, id: String) -> Result<RunReport, AppError> {
    let automation = db.with(|c| automations::get(c, &id))?;
    automations::run(&db, &automation)
}

/// Called by the UI right after the user switches Space. Does nothing unless
/// the master switch is on and the automation is enabled.
#[tauri::command(async)]
pub fn automation_run_for_space(db: State<'_, Database>, space_id: String) -> Result<Vec<RunReport>, AppError> {
    let due = db.with(|c| automations::due_for_space(c, &space_id))?;
    let mut reports = Vec::new();
    for automation in &due {
        reports.push(automations::run(&db, automation)?);
    }
    Ok(reports)
}

#[tauri::command]
pub fn automation_log(db: State<'_, Database>, limit: Option<i64>) -> Result<Vec<LogEntry>, AppError> {
    db.with(|c| automations::log_list(c, limit.unwrap_or(50)))
}
#[tauri::command]
pub fn automation_log_clear(db: State<'_, Database>) -> Result<(), AppError> {
    db.with(automations::log_clear)
}
