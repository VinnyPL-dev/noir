use tauri::State;

use crate::apps::{self, AppRecord};
use crate::db::Database;
use crate::error::AppError;

#[tauri::command]
pub fn orbit_list(db: State<'_, Database>) -> Result<Vec<AppRecord>, AppError> {
    db.with(|conn| apps::list(conn))
}

/// Re-reads the Start menu. Slow (runs PowerShell), so it executes on the thread pool.
#[tauri::command(async)]
pub fn orbit_scan(db: State<'_, Database>) -> Result<Vec<AppRecord>, AppError> {
    let found = apps::discover()?;
    db.with(|conn| {
        apps::sync_discovered(conn, &found)?;
        apps::list(conn)
    })
}

/// Launches by id only: the UI never supplies a path to execute.
#[tauri::command]
pub fn orbit_launch(db: State<'_, Database>, id: String) -> Result<(), AppError> {
    let (kind, target) = db.with(|conn| apps::launch_target(conn, &id))?;
    apps::launch(&kind, &target)?;
    db.with(|conn| apps::record_launch(conn, &id))
}

#[tauri::command]
pub fn orbit_set_favorite(db: State<'_, Database>, id: String, favorite: bool) -> Result<(), AppError> {
    db.with(|conn| apps::set_favorite(conn, &id, favorite))
}

#[tauri::command]
pub fn orbit_set_hidden(db: State<'_, Database>, id: String, hidden: bool) -> Result<(), AppError> {
    db.with(|conn| apps::set_hidden(conn, &id, hidden))
}

#[tauri::command]
pub fn orbit_set_category(db: State<'_, Database>, id: String, category: String) -> Result<(), AppError> {
    db.with(|conn| apps::set_category(conn, &id, &category))
}

#[tauri::command]
pub fn orbit_set_icon(db: State<'_, Database>, id: String, icon: Option<String>) -> Result<(), AppError> {
    db.with(|conn| apps::set_icon(conn, &id, icon.as_deref()))
}

#[tauri::command]
pub fn orbit_rename(db: State<'_, Database>, id: String, name: String) -> Result<(), AppError> {
    db.with(|conn| apps::rename(conn, &id, &name))
}

#[tauri::command]
pub fn orbit_add_custom(
    db: State<'_, Database>,
    name: Option<String>,
    path: String,
    category: String,
) -> Result<AppRecord, AppError> {
    db.with(|conn| apps::add_custom(conn, name.as_deref(), &path, &category))
}

#[tauri::command]
pub fn orbit_remove(db: State<'_, Database>, id: String) -> Result<(), AppError> {
    db.with(|conn| apps::remove_custom(conn, &id))
}
