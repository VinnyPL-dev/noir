use tauri::State;

use crate::db::Database;
use crate::error::AppError;
use crate::flow::{self, Note, Project, Task, WorkSession};
use crate::shell;

// ── notes ──
#[tauri::command]
pub fn note_list(db: State<'_, Database>, query: Option<String>) -> Result<Vec<Note>, AppError> {
    db.with(|c| flow::note_list(c, query.as_deref()))
}
#[tauri::command]
pub fn note_create(db: State<'_, Database>, title: Option<String>, body: Option<String>) -> Result<Note, AppError> {
    db.with(|c| flow::note_create(c, title.as_deref().unwrap_or(""), body.as_deref().unwrap_or("")))
}
#[tauri::command]
pub fn note_update(db: State<'_, Database>, id: String, title: String, body: String) -> Result<i64, AppError> {
    db.with(|c| flow::note_update(c, &id, &title, &body))
}
#[tauri::command]
pub fn note_set_pinned(db: State<'_, Database>, id: String, pinned: bool) -> Result<(), AppError> {
    db.with(|c| flow::note_set_pinned(c, &id, pinned))
}
#[tauri::command]
pub fn note_delete(db: State<'_, Database>, id: String) -> Result<(), AppError> {
    db.with(|c| flow::note_delete(c, &id))
}

// ── tasks ──
#[tauri::command]
pub fn task_list(db: State<'_, Database>) -> Result<Vec<Task>, AppError> {
    db.with(flow::task_list)
}
#[tauri::command]
pub fn task_add(db: State<'_, Database>, title: String, project_id: Option<String>, due: Option<i64>) -> Result<Task, AppError> {
    db.with(|c| flow::task_add(c, &title, project_id.as_deref(), due))
}
#[tauri::command]
pub fn task_update(db: State<'_, Database>, id: String, title: String, project_id: Option<String>, due: Option<i64>) -> Result<(), AppError> {
    db.with(|c| flow::task_update(c, &id, &title, project_id.as_deref(), due))
}
#[tauri::command]
pub fn task_set_done(db: State<'_, Database>, id: String, done: bool) -> Result<(), AppError> {
    db.with(|c| flow::task_set_done(c, &id, done))
}
#[tauri::command]
pub fn task_set_pinned(db: State<'_, Database>, id: String, pinned: bool) -> Result<(), AppError> {
    db.with(|c| flow::task_set_pinned(c, &id, pinned))
}
#[tauri::command]
pub fn task_delete(db: State<'_, Database>, id: String) -> Result<(), AppError> {
    db.with(|c| flow::task_delete(c, &id))
}
#[tauri::command]
pub fn task_clear_done(db: State<'_, Database>) -> Result<usize, AppError> {
    db.with(flow::task_clear_done)
}

// ── projects ──
fn checked_folder(path: Option<String>) -> Result<Option<String>, AppError> {
    match path.as_deref().map(str::trim).filter(|p| !p.is_empty()) {
        Some(p) => Ok(Some(shell::existing_dir(p)?.to_string_lossy().to_string())),
        None => Ok(None),
    }
}
#[tauri::command]
pub fn project_list(db: State<'_, Database>) -> Result<Vec<Project>, AppError> {
    db.with(flow::project_list)
}
#[tauri::command]
pub fn project_add(db: State<'_, Database>, name: String, path: Option<String>) -> Result<Project, AppError> {
    let path = checked_folder(path)?;
    db.with(|c| flow::project_add(c, &name, path.as_deref()))
}
#[tauri::command]
pub fn project_update(db: State<'_, Database>, id: String, name: String, path: Option<String>) -> Result<Project, AppError> {
    let path = checked_folder(path)?;
    db.with(|c| flow::project_update(c, &id, &name, path.as_deref()))
}
#[tauri::command]
pub fn project_set_archived(db: State<'_, Database>, id: String, archived: bool) -> Result<(), AppError> {
    db.with(|c| flow::project_set_archived(c, &id, archived))
}
#[tauri::command]
pub fn project_delete(db: State<'_, Database>, id: String) -> Result<(), AppError> {
    db.with(|c| flow::project_delete(c, &id))
}
#[tauri::command(async)]
pub fn project_open(db: State<'_, Database>, id: String) -> Result<(), AppError> {
    let path = db
        .with(|c| flow::project_path(c, &id))?
        .ok_or_else(|| AppError::Invalid("This project has no folder yet. Edit it to choose one.".into()))?;
    let dir = shell::existing_dir(&path)?;
    shell::open_folder(&dir)?;
    db.with(|c| flow::project_touch(c, &id))
}

// ── focus sessions ──
#[tauri::command]
pub fn session_add(
    db: State<'_, Database>,
    label: String,
    project_id: Option<String>,
    started_at: i64,
    duration_secs: i64,
    kind: String,
) -> Result<WorkSession, AppError> {
    db.with(|c| flow::session_add(c, &label, project_id.as_deref(), started_at, duration_secs, &kind))
}
#[tauri::command]
pub fn session_list(db: State<'_, Database>, limit: Option<i64>) -> Result<Vec<WorkSession>, AppError> {
    db.with(|c| flow::session_list(c, limit.unwrap_or(200)))
}
#[tauri::command]
pub fn session_delete(db: State<'_, Database>, id: String) -> Result<(), AppError> {
    db.with(|c| flow::session_delete(c, &id))
}
