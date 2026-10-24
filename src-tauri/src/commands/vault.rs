use std::time::Duration;

use sysinfo::Disks;
use tauri::State;

use crate::db::Database;
use crate::error::AppError;
use crate::shell;
use crate::vault::{self, Breakdown, Collection, CollectionItem, DupOutcome, FavFolder, Listing, Preview, Recent, Root, SearchOutcome, TrashReport};

#[tauri::command]
pub fn vault_roots() -> Vec<Root> {
    let disks = Disks::new_with_refreshed_list();
    let mut mounts: Vec<String> = disks
        .iter()
        .filter(|d| d.total_space() > 0)
        .map(|d| d.mount_point().to_string_lossy().to_string())
        .collect();
    mounts.sort();
    mounts.dedup();
    vault::roots(&mounts)
}

#[tauri::command(async)]
pub fn vault_list_dir(path: String) -> Result<Listing, AppError> {
    let dir = shell::existing_dir(&path)?;
    vault::list_dir(&dir)
}

#[tauri::command(async)]
pub fn vault_search(root: String, query: String) -> Result<SearchOutcome, AppError> {
    let dir = shell::existing_dir(&root)?;
    Ok(vault::search(&dir, &query, 300, Duration::from_secs(12)))
}

#[tauri::command(async)]
pub fn vault_breakdown(path: String) -> Result<Breakdown, AppError> {
    let dir = shell::existing_dir(&path)?;
    vault::breakdown(&dir, Duration::from_secs(25))
}

#[tauri::command(async)]
pub fn vault_duplicates(root: String, min_size: Option<u64>) -> Result<DupOutcome, AppError> {
    let dir = shell::existing_dir(&root)?;
    Ok(vault::find_duplicates(&dir, min_size.unwrap_or(1024 * 1024), Duration::from_secs(60)))
}

#[tauri::command(async)]
pub fn vault_preview(path: String) -> Result<Preview, AppError> {
    let p = shell::existing_path(&path)?;
    vault::preview(&p)
}

/// Opens a folder in Explorer or a file in its default app (programs are refused).
#[tauri::command(async)]
pub fn vault_open(db: State<'_, Database>, path: String) -> Result<(), AppError> {
    let p = shell::existing_path(&path)?;
    if p.is_dir() {
        shell::open_folder(&p)?;
    } else {
        shell::open_file(&p)?;
    }
    db.with(|c| vault::recent_add(c, &p))
}

#[tauri::command(async)]
pub fn vault_reveal(path: String) -> Result<(), AppError> {
    let p = shell::existing_path(&path)?;
    shell::reveal(&p)
}

/// Moves items to the Recycle Bin. `confirmed` must be true: the UI sets it only after the user agrees.
#[tauri::command(async)]
pub fn vault_trash(paths: Vec<String>, confirmed: bool) -> Result<TrashReport, AppError> {
    vault::trash_paths(&paths, confirmed)
}

#[tauri::command]
pub fn vault_folder_list(db: State<'_, Database>) -> Result<Vec<FavFolder>, AppError> {
    db.with(vault::folder_list)
}
#[tauri::command]
pub fn vault_folder_add(db: State<'_, Database>, path: String, label: Option<String>) -> Result<(), AppError> {
    let dir = shell::existing_dir(&path)?;
    db.with(|c| vault::folder_add(c, &dir, label.as_deref()))
}
#[tauri::command]
pub fn vault_folder_remove(db: State<'_, Database>, path: String) -> Result<(), AppError> {
    db.with(|c| vault::folder_remove(c, &path))
}

#[tauri::command]
pub fn vault_recent_list(db: State<'_, Database>, limit: Option<i64>) -> Result<Vec<Recent>, AppError> {
    db.with(|c| vault::recent_list(c, limit.unwrap_or(20)))
}
#[tauri::command]
pub fn vault_recent_clear(db: State<'_, Database>) -> Result<(), AppError> {
    db.with(vault::recent_clear)
}

#[tauri::command]
pub fn vault_collection_list(db: State<'_, Database>) -> Result<Vec<Collection>, AppError> {
    db.with(vault::collection_list)
}
#[tauri::command]
pub fn vault_collection_create(db: State<'_, Database>, name: String) -> Result<Collection, AppError> {
    db.with(|c| vault::collection_create(c, &name))
}
#[tauri::command]
pub fn vault_collection_rename(db: State<'_, Database>, id: String, name: String) -> Result<(), AppError> {
    db.with(|c| vault::collection_rename(c, &id, &name))
}
#[tauri::command]
pub fn vault_collection_delete(db: State<'_, Database>, id: String) -> Result<(), AppError> {
    db.with(|c| vault::collection_delete(c, &id))
}
#[tauri::command]
pub fn vault_collection_items(db: State<'_, Database>, id: String) -> Result<Vec<CollectionItem>, AppError> {
    db.with(|c| vault::collection_items(c, &id))
}
#[tauri::command]
pub fn vault_collection_add(db: State<'_, Database>, id: String, paths: Vec<String>) -> Result<usize, AppError> {
    let checked = paths
        .iter()
        .map(|p| shell::existing_path(p))
        .collect::<Result<Vec<_>, _>>()?;
    db.with(|c| vault::collection_add(c, &id, &checked))
}
#[tauri::command]
pub fn vault_collection_remove(db: State<'_, Database>, id: String, path: String) -> Result<(), AppError> {
    db.with(|c| vault::collection_remove(c, &id, &path))
}
