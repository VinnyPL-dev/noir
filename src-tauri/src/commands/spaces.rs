use tauri::State;

use crate::db::Database;
use crate::error::AppError;
use crate::spaces::{self, Shortcut, Space};

#[tauri::command]
pub fn spaces_list(db: State<'_, Database>) -> Result<Vec<Space>, AppError> {
    db.with(spaces::list)
}
#[tauri::command]
pub fn space_create(db: State<'_, Database>, name: String, icon: String, shortcuts: Option<Vec<Shortcut>>) -> Result<Space, AppError> {
    db.with(|c| spaces::create(c, &name, &icon, &shortcuts.unwrap_or_default()))
}
#[tauri::command]
pub fn space_update(db: State<'_, Database>, id: String, name: String, icon: String) -> Result<Space, AppError> {
    db.with(|c| spaces::update(c, &id, &name, &icon))
}
#[tauri::command]
pub fn space_set_layout(db: State<'_, Database>, id: String, layout: Option<String>) -> Result<(), AppError> {
    db.with(|c| spaces::set_layout(c, &id, layout.as_deref()))
}
#[tauri::command]
pub fn space_set_prefs(db: State<'_, Database>, id: String, prefs: String) -> Result<(), AppError> {
    db.with(|c| spaces::set_prefs(c, &id, &prefs))
}
#[tauri::command]
pub fn space_set_shortcuts(db: State<'_, Database>, id: String, shortcuts: Vec<Shortcut>) -> Result<(), AppError> {
    db.with(|c| spaces::set_shortcuts(c, &id, &shortcuts))
}
#[tauri::command]
pub fn space_delete(db: State<'_, Database>, id: String) -> Result<(), AppError> {
    db.with(|c| spaces::delete(c, &id))
}
#[tauri::command]
pub fn spaces_reorder(db: State<'_, Database>, ids: Vec<String>) -> Result<(), AppError> {
    db.with(|c| spaces::reorder(c, &ids))
}

/// Opens a web link from a Space shortcut. Only http(s) links are accepted.
#[tauri::command(async)]
pub fn open_url(url: String) -> Result<(), AppError> {
    crate::shell::open_url(&url)
}
