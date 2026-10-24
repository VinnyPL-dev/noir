//! VAULT — file workspace: browse, search, preview, storage breakdown,
//! duplicate detection, favorites, recents and collections.
//!
//! Scans are bounded by a time budget and an entry cap so a huge drive can
//! never freeze the app; results say honestly when they were cut short.
//! Deleting only ever moves items to the Recycle Bin, and refuses system paths.

use std::collections::{HashMap, VecDeque};
use std::fs;
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::time::{Duration, Instant, UNIX_EPOCH};

use base64::Engine;
use rusqlite::{params, Connection};
use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::error::AppError;
use crate::state::{new_id, now_ms};

const SKIP_ALWAYS: &[&str] = &["$recycle.bin", "system volume information", "$windows.~bt", "$windows.~ws"];
const SKIP_NOISY: &[&str] = &[".git", "node_modules", "target", ".cache"];
const MAX_VISITED: u64 = 600_000;
const MAX_LIST: usize = 5_000;

fn skip_always(name: &str) -> bool {
    SKIP_ALWAYS.contains(&name.to_ascii_lowercase().as_str())
}
fn skip_noisy(name: &str) -> bool {
    skip_always(name) || SKIP_NOISY.contains(&name.to_ascii_lowercase().as_str())
}

fn modified_ms(md: &fs::Metadata) -> Option<i64> {
    md.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
}

fn path_string(p: &Path) -> String {
    p.to_string_lossy().to_string()
}

// ───────────────────────────── listing ─────────────────────────────

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: Option<i64>,
}

fn entry_of(path: &Path, md: &fs::Metadata) -> Entry {
    Entry {
        name: path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| path_string(path)),
        path: path_string(path),
        is_dir: md.is_dir(),
        size: if md.is_dir() { 0 } else { md.len() },
        modified: modified_ms(md),
    }
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Listing {
    pub path: String,
    pub parent: Option<String>,
    pub entries: Vec<Entry>,
    pub truncated: bool,
}

pub fn list_dir(path: &Path) -> Result<Listing, AppError> {
    let rd = fs::read_dir(path).map_err(|e| match e.kind() {
        std::io::ErrorKind::PermissionDenied => AppError::Invalid("Windows won't let NOIR open that folder.".into()),
        _ => AppError::Io(e),
    })?;
    let mut entries = Vec::new();
    let mut truncated = false;
    for item in rd.flatten() {
        if entries.len() >= MAX_LIST {
            truncated = true;
            break;
        }
        if let Ok(md) = fs::metadata(item.path()) {
            entries.push(entry_of(&item.path(), &md));
        }
    }
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(Listing {
        path: path_string(path),
        parent: path.parent().map(path_string),
        entries,
        truncated,
    })
}

// ───────────────────────────── search ─────────────────────────────

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SearchOutcome {
    pub hits: Vec<Entry>,
    pub scanned: u64,
    pub truncated: bool,
    pub elapsed_ms: u64,
}

pub fn search(root: &Path, query: &str, max_hits: usize, budget: Duration) -> SearchOutcome {
    let started = Instant::now();
    let terms: Vec<String> = query.split_whitespace().map(|t| t.to_lowercase()).collect();
    let mut hits = Vec::new();
    let mut scanned = 0u64;
    let mut truncated = false;
    if terms.is_empty() {
        return SearchOutcome { hits, scanned, truncated, elapsed_ms: 0 };
    }
    let mut queue = VecDeque::from([root.to_path_buf()]);
    'outer: while let Some(dir) = queue.pop_front() {
        let Ok(rd) = fs::read_dir(&dir) else { continue };
        for item in rd.flatten() {
            scanned += 1;
            if scanned >= MAX_VISITED || started.elapsed() >= budget || hits.len() >= max_hits {
                truncated = true;
                break 'outer;
            }
            let Ok(ft) = item.file_type() else { continue };
            let name = item.file_name().to_string_lossy().to_string();
            let lower = name.to_lowercase();
            if terms.iter().all(|t| lower.contains(t)) {
                if let Ok(md) = item.metadata() {
                    hits.push(entry_of(&item.path(), &md));
                }
            }
            if ft.is_dir() && !ft.is_symlink() && !skip_noisy(&name) {
                queue.push_back(item.path());
            }
        }
    }
    SearchOutcome { hits, scanned, truncated, elapsed_ms: started.elapsed().as_millis() as u64 }
}

// ───────────────────────────── storage breakdown ─────────────────────────────

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BreakdownItem {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    /// True when the scan stopped before this item was fully measured.
    pub partial: bool,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Breakdown {
    pub items: Vec<BreakdownItem>,
    pub total: u64,
    pub complete: bool,
}

fn dir_size(root: &Path, deadline: Instant, visited: &mut u64) -> (u64, bool) {
    let mut total = 0u64;
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let Ok(rd) = fs::read_dir(&dir) else { continue };
        for item in rd.flatten() {
            *visited += 1;
            if *visited >= MAX_VISITED || (*visited % 256 == 0 && Instant::now() >= deadline) {
                return (total, false);
            }
            let Ok(ft) = item.file_type() else { continue };
            if ft.is_symlink() {
                continue;
            }
            if ft.is_dir() {
                if !skip_always(&item.file_name().to_string_lossy()) {
                    stack.push(item.path());
                }
            } else if let Ok(md) = item.metadata() {
                total += md.len();
            }
        }
    }
    (total, true)
}

pub fn breakdown(root: &Path, budget: Duration) -> Result<Breakdown, AppError> {
    let deadline = Instant::now() + budget;
    let rd = fs::read_dir(root).map_err(AppError::Io)?;
    let mut visited = 0u64;
    let mut items = Vec::new();
    let mut complete = true;
    for item in rd.flatten() {
        let Ok(ft) = item.file_type() else { continue };
        if ft.is_symlink() {
            continue;
        }
        let path = item.path();
        let name = item.file_name().to_string_lossy().to_string();
        if ft.is_dir() {
            if skip_always(&name) {
                continue;
            }
            let (size, done) = dir_size(&path, deadline, &mut visited);
            complete &= done;
            items.push(BreakdownItem { name, path: path_string(&path), is_dir: true, size, partial: !done });
        } else if let Ok(md) = item.metadata() {
            items.push(BreakdownItem { name, path: path_string(&path), is_dir: false, size: md.len(), partial: false });
        }
    }
    items.sort_by(|a, b| b.size.cmp(&a.size).then_with(|| a.name.cmp(&b.name)));
    let total = items.iter().map(|i| i.size).sum();
    Ok(Breakdown { items, total, complete })
}

// ───────────────────────────── duplicates ─────────────────────────────

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DupFile {
    pub path: String,
    pub modified: Option<i64>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DupGroup {
    pub size: u64,
    pub wasted: u64,
    pub files: Vec<DupFile>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DupOutcome {
    pub groups: Vec<DupGroup>,
    pub scanned: u64,
    pub truncated: bool,
}

fn hash_file(path: &Path, limit: Option<u64>) -> std::io::Result<[u8; 32]> {
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 128 * 1024];
    let mut remaining = limit.unwrap_or(u64::MAX);
    while remaining > 0 {
        let want = buf.len().min(remaining.min(usize::MAX as u64) as usize);
        let n = file.read(&mut buf[..want])?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
        remaining -= n as u64;
    }
    Ok(hasher.finalize().into())
}

/// Finds byte-identical files: group by size, then by a 64 KB prefix hash,
/// then confirm with a full SHA-256.
pub fn find_duplicates(root: &Path, min_size: u64, budget: Duration) -> DupOutcome {
    let deadline = Instant::now() + budget;
    let min_size = min_size.max(1);
    let mut by_size: HashMap<u64, Vec<(PathBuf, Option<i64>)>> = HashMap::new();
    let mut scanned = 0u64;
    let mut truncated = false;

    let mut stack = vec![root.to_path_buf()];
    'walk: while let Some(dir) = stack.pop() {
        let Ok(rd) = fs::read_dir(&dir) else { continue };
        for item in rd.flatten() {
            scanned += 1;
            if scanned >= MAX_VISITED || (scanned % 256 == 0 && Instant::now() >= deadline) {
                truncated = true;
                break 'walk;
            }
            let Ok(ft) = item.file_type() else { continue };
            if ft.is_symlink() {
                continue;
            }
            if ft.is_dir() {
                if !skip_noisy(&item.file_name().to_string_lossy()) {
                    stack.push(item.path());
                }
            } else if let Ok(md) = item.metadata() {
                if md.len() >= min_size {
                    by_size.entry(md.len()).or_default().push((item.path(), modified_ms(&md)));
                }
            }
        }
    }

    let mut groups = Vec::new();
    'sizes: for (size, files) in by_size.into_iter().filter(|(_, f)| f.len() > 1) {
        let mut by_prefix: HashMap<[u8; 32], Vec<(PathBuf, Option<i64>)>> = HashMap::new();
        for f in files {
            if Instant::now() >= deadline {
                truncated = true;
                break 'sizes;
            }
            if let Ok(h) = hash_file(&f.0, Some(64 * 1024)) {
                by_prefix.entry(h).or_default().push(f);
            }
        }
        for (_, candidates) in by_prefix.into_iter().filter(|(_, f)| f.len() > 1) {
            let mut by_full: HashMap<[u8; 32], Vec<DupFile>> = HashMap::new();
            for (path, modified) in candidates {
                if Instant::now() >= deadline {
                    truncated = true;
                    break 'sizes;
                }
                if let Ok(h) = hash_file(&path, None) {
                    by_full.entry(h).or_default().push(DupFile { path: path_string(&path), modified });
                }
            }
            for (_, mut same) in by_full.into_iter().filter(|(_, f)| f.len() > 1) {
                same.sort_by(|a, b| a.path.cmp(&b.path));
                let wasted = size * (same.len() as u64 - 1);
                groups.push(DupGroup { size, wasted, files: same });
            }
        }
    }
    groups.sort_by(|a, b| b.wasted.cmp(&a.wasted).then_with(|| a.files[0].path.cmp(&b.files[0].path)));
    groups.truncate(300);
    DupOutcome { groups, scanned, truncated }
}

// ───────────────────────────── preview ─────────────────────────────

#[derive(Serialize, Debug)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum Preview {
    Text { text: String, truncated: bool, size: u64 },
    Image { data_url: String, size: u64 },
    None { reason: String, size: u64 },
}

const TEXT_BYTES: usize = 64 * 1024;
const IMAGE_MAX: u64 = 6 * 1024 * 1024;

fn image_mime(ext: &str) -> Option<&'static str> {
    Some(match ext {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "svg" => "image/svg+xml",
        _ => return None,
    })
}

pub fn preview(path: &Path) -> Result<Preview, AppError> {
    let md = fs::metadata(path)?;
    if md.is_dir() {
        return Ok(Preview::None { reason: "This is a folder.".into(), size: 0 });
    }
    let size = md.len();
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();

    if let Some(mime) = image_mime(&ext) {
        if size > IMAGE_MAX {
            return Ok(Preview::None { reason: "This image is too large to preview (6 MB limit).".into(), size });
        }
        let bytes = fs::read(path)?;
        let data_url = format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes));
        return Ok(Preview::Image { data_url, size });
    }

    let mut buf = vec![0u8; TEXT_BYTES];
    let mut file = fs::File::open(path)?;
    let mut filled = 0;
    while filled < buf.len() {
        let n = file.read(&mut buf[filled..])?;
        if n == 0 {
            break;
        }
        filled += n;
    }
    buf.truncate(filled);
    if buf.is_empty() {
        return Ok(Preview::None { reason: "This file is empty.".into(), size });
    }
    if buf.iter().take(8192).any(|b| *b == 0) {
        return Ok(Preview::None { reason: "No preview for this file type.".into(), size });
    }
    Ok(Preview::Text {
        text: String::from_utf8_lossy(&buf).to_string(),
        truncated: size > filled as u64,
        size,
    })
}

// ───────────────────────────── safe delete ─────────────────────────────

fn env_path(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|v| !v.is_empty()).map(|v| norm(&v))
}

fn norm(p: &str) -> String {
    p.replace('/', "\\").trim_end_matches('\\').to_lowercase()
}

/// Drive roots, the Windows folder, Program Files, the user profile itself
/// and its well-known folders can never be deleted from NOIR.
pub fn is_protected(path: &Path) -> bool {
    let normals = path.components().filter(|c| matches!(c, Component::Normal(_))).count();
    if normals < 2 {
        return true;
    }
    let this = norm(&path_string(path));
    let exact: Vec<String> = ["USERPROFILE", "ProgramFiles", "ProgramFiles(x86)", "ProgramData", "APPDATA", "LOCALAPPDATA"]
        .iter()
        .filter_map(|k| env_path(k))
        .chain(
            ["Desktop", "Documents", "Downloads", "Pictures", "Music", "Videos"]
                .iter()
                .filter_map(|f| env_path("USERPROFILE").map(|u| format!("{u}\\{}", f.to_lowercase()))),
        )
        .collect();
    if exact.iter().any(|e| *e == this) {
        return true;
    }
    ["SystemRoot", "windir"]
        .iter()
        .filter_map(|k| env_path(k))
        .any(|root| this == root || this.starts_with(&format!("{root}\\")))
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TrashReport {
    pub moved: usize,
    pub failed: Vec<String>,
}

pub fn trash_paths(raw: &[String], confirmed: bool) -> Result<TrashReport, AppError> {
    if !confirmed {
        return Err(AppError::Invalid("Deleting needs your confirmation.".into()));
    }
    if raw.is_empty() || raw.len() > 500 {
        return Err(AppError::Invalid("Choose between 1 and 500 items.".into()));
    }
    let mut paths = Vec::new();
    for r in raw {
        let p = crate::shell::existing_path(r)?;
        if is_protected(&p) {
            return Err(AppError::Invalid(format!("{} is protected and can't be deleted from NOIR.", p.display())));
        }
        paths.push(p);
    }
    let mut moved = 0;
    let mut failed = Vec::new();
    for p in paths {
        match trash::delete(&p) {
            Ok(()) => moved += 1,
            Err(e) => failed.push(format!("{}: {e}", p.display())),
        }
    }
    Ok(TrashReport { moved, failed })
}

// ───────────────────────────── favorites, recents, collections ─────────────────────────────

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FavFolder {
    pub path: String,
    pub label: String,
    pub exists: bool,
}

pub fn folder_list(conn: &Connection) -> Result<Vec<FavFolder>, AppError> {
    let mut stmt = conn.prepare("SELECT path, label FROM vault_folders ORDER BY added_at")?;
    let rows = stmt.query_map([], |r| {
        let path: String = r.get(0)?;
        Ok(FavFolder { exists: Path::new(&path).is_dir(), path, label: r.get(1)? })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn folder_add(conn: &Connection, path: &Path, label: Option<&str>) -> Result<(), AppError> {
    let default = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| path_string(path));
    let label = label.map(str::trim).filter(|l| !l.is_empty()).map(str::to_string).unwrap_or(default);
    if label.chars().count() > 60 {
        return Err(AppError::Invalid("That name is too long.".into()));
    }
    conn.execute(
        "INSERT INTO vault_folders (path, label, added_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(path) DO UPDATE SET label = excluded.label",
        params![path_string(path), label, now_ms() as i64],
    )?;
    Ok(())
}

pub fn folder_remove(conn: &Connection, path: &str) -> Result<(), AppError> {
    conn.execute("DELETE FROM vault_folders WHERE path = ?1", params![path])?;
    Ok(())
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Recent {
    pub path: String,
    pub name: String,
    pub opened_at: i64,
    pub exists: bool,
    pub is_dir: bool,
}

pub fn recent_add(conn: &Connection, path: &Path) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO vault_recent (path, opened_at) VALUES (?1, ?2)
         ON CONFLICT(path) DO UPDATE SET opened_at = excluded.opened_at",
        params![path_string(path), now_ms() as i64],
    )?;
    conn.execute(
        "DELETE FROM vault_recent WHERE path NOT IN (SELECT path FROM vault_recent ORDER BY opened_at DESC LIMIT 100)",
        [],
    )?;
    Ok(())
}

pub fn recent_list(conn: &Connection, limit: i64) -> Result<Vec<Recent>, AppError> {
    let mut stmt = conn.prepare("SELECT path, opened_at FROM vault_recent ORDER BY opened_at DESC LIMIT ?1")?;
    let rows = stmt.query_map(params![limit.clamp(1, 100)], |r| {
        let path: String = r.get(0)?;
        let p = Path::new(&path);
        Ok(Recent {
            name: p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| path.clone()),
            exists: p.exists(),
            is_dir: p.is_dir(),
            opened_at: r.get(1)?,
            path,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn recent_clear(conn: &Connection) -> Result<(), AppError> {
    conn.execute("DELETE FROM vault_recent", [])?;
    Ok(())
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub count: i64,
    pub created_at: i64,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CollectionItem {
    pub path: String,
    pub name: String,
    pub exists: bool,
    pub is_dir: bool,
    pub size: u64,
}

pub fn collection_list(conn: &Connection) -> Result<Vec<Collection>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT c.id, c.name, c.created_at, (SELECT COUNT(*) FROM vault_collection_items i WHERE i.collection_id = c.id)
         FROM vault_collections c ORDER BY c.created_at",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(Collection { id: r.get(0)?, name: r.get(1)?, created_at: r.get(2)?, count: r.get(3)? })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn collection_create(conn: &Connection, name: &str) -> Result<Collection, AppError> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 60 {
        return Err(AppError::Invalid("Give the collection a name (up to 60 characters).".into()));
    }
    let id = new_id("coll");
    let now = now_ms() as i64;
    conn.execute("INSERT INTO vault_collections (id, name, created_at) VALUES (?1, ?2, ?3)", params![id, name, now])?;
    Ok(Collection { id, name: name.to_string(), count: 0, created_at: now })
}

pub fn collection_rename(conn: &Connection, id: &str, name: &str) -> Result<(), AppError> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 60 {
        return Err(AppError::Invalid("Give the collection a name (up to 60 characters).".into()));
    }
    let n = conn.execute("UPDATE vault_collections SET name = ?2 WHERE id = ?1", params![id, name])?;
    if n == 0 {
        return Err(AppError::Invalid("That collection no longer exists.".into()));
    }
    Ok(())
}

pub fn collection_delete(conn: &Connection, id: &str) -> Result<(), AppError> {
    conn.execute("DELETE FROM vault_collections WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn collection_items(conn: &Connection, id: &str) -> Result<Vec<CollectionItem>, AppError> {
    let mut stmt = conn.prepare("SELECT path FROM vault_collection_items WHERE collection_id = ?1 ORDER BY added_at")?;
    let rows = stmt.query_map(params![id], |r| {
        let path: String = r.get(0)?;
        let p = Path::new(&path);
        let md = fs::metadata(p).ok();
        Ok(CollectionItem {
            name: p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| path.clone()),
            exists: md.is_some(),
            is_dir: md.as_ref().map(|m| m.is_dir()).unwrap_or(false),
            size: md.as_ref().filter(|m| m.is_file()).map(|m| m.len()).unwrap_or(0),
            path,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn collection_add(conn: &Connection, id: &str, paths: &[PathBuf]) -> Result<usize, AppError> {
    let exists: i64 = conn.query_row("SELECT COUNT(*) FROM vault_collections WHERE id = ?1", params![id], |r| r.get(0))?;
    if exists == 0 {
        return Err(AppError::Invalid("That collection no longer exists.".into()));
    }
    let mut added = 0;
    for p in paths {
        added += conn.execute(
            "INSERT OR IGNORE INTO vault_collection_items (collection_id, path, added_at) VALUES (?1, ?2, ?3)",
            params![id, path_string(p), now_ms() as i64],
        )?;
    }
    Ok(added)
}

pub fn collection_remove(conn: &Connection, id: &str, path: &str) -> Result<(), AppError> {
    conn.execute(
        "DELETE FROM vault_collection_items WHERE collection_id = ?1 AND path = ?2",
        params![id, path],
    )?;
    Ok(())
}

// ───────────────────────────── roots ─────────────────────────────

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Root {
    pub label: String,
    pub path: String,
    pub kind: &'static str,
}

/// Well-known user folders (that exist) followed by every mounted drive.
pub fn roots(drive_mounts: &[String]) -> Vec<Root> {
    let mut out = Vec::new();
    if let Ok(profile) = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")) {
        for name in ["Desktop", "Documents", "Downloads", "Pictures", "Music", "Videos"] {
            let p = Path::new(&profile).join(name);
            if p.is_dir() {
                out.push(Root { label: name.into(), path: path_string(&p), kind: "folder" });
            }
        }
    }
    for m in drive_mounts {
        out.push(Root { label: m.trim_end_matches('\\').to_string(), path: m.clone(), kind: "drive" });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrate;
    use std::io::Write;

    fn tmp(name: &str) -> PathBuf {
        let p = std::env::temp_dir().join(format!("noir_vault_{name}_{}", now_ms()));
        fs::create_dir_all(&p).unwrap();
        p
    }
    fn write(p: &Path, bytes: &[u8]) {
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::File::create(p).unwrap().write_all(bytes).unwrap();
    }

    #[test]
    fn lists_dirs_first_and_searches_by_all_terms() {
        let root = tmp("list");
        write(&root.join("b.txt"), b"x");
        write(&root.join("sub/Quarterly Report 2026.docx"), b"x");
        write(&root.join("sub/notes.txt"), b"x");
        write(&root.join("node_modules/report.txt"), b"x");
        let l = list_dir(&root).unwrap();
        assert!(l.entries[0].is_dir && l.entries[0].name == "node_modules" || l.entries[0].name == "sub");
        let hits = search(&root, "report quarterly", 50, Duration::from_secs(5));
        assert_eq!(hits.hits.len(), 1);
        assert!(hits.hits[0].name.contains("Quarterly"));
        assert!(search(&root, "report", 50, Duration::from_secs(5)).hits.iter().all(|h| !h.path.contains("node_modules")));
        assert!(search(&root, "   ", 50, Duration::from_secs(5)).hits.is_empty());
        assert!(search(&root, "txt", 1, Duration::from_secs(5)).truncated);
        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn breakdown_sums_sizes() {
        let root = tmp("size");
        write(&root.join("a/one.bin"), &[0u8; 1000]);
        write(&root.join("a/deep/two.bin"), &[0u8; 500]);
        write(&root.join("top.bin"), &[0u8; 200]);
        let b = breakdown(&root, Duration::from_secs(5)).unwrap();
        assert!(b.complete);
        assert_eq!(b.total, 1700);
        assert_eq!(b.items[0].name, "a");
        assert_eq!(b.items[0].size, 1500);
        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn duplicates_need_identical_bytes_not_just_size() {
        let root = tmp("dups");
        write(&root.join("x/a.dat"), &[7u8; 4096]);
        write(&root.join("y/copy.dat"), &[7u8; 4096]);
        write(&root.join("z/other.dat"), &[8u8; 4096]);
        let mut tail_differs = vec![1u8; 100_000];
        write(&root.join("p/big1.dat"), &tail_differs);
        *tail_differs.last_mut().unwrap() = 2;
        write(&root.join("q/big2.dat"), &tail_differs);
        let out = find_duplicates(&root, 1, Duration::from_secs(10));
        assert_eq!(out.groups.len(), 1, "same size but different content must not match");
        assert_eq!(out.groups[0].files.len(), 2);
        assert_eq!(out.groups[0].wasted, 4096);
        assert!(find_duplicates(&root, 1_000_000, Duration::from_secs(5)).groups.is_empty());
        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn previews_text_images_and_binaries() {
        let root = tmp("prev");
        write(&root.join("a.txt"), "héllo".as_bytes());
        write(&root.join("pic.png"), &[137, 80, 78, 71]);
        write(&root.join("blob.bin"), &[1, 2, 0, 3]);
        write(&root.join("empty.txt"), b"");
        write(&root.join("big.log"), &vec![b'a'; TEXT_BYTES + 10]);
        assert!(matches!(preview(&root.join("a.txt")).unwrap(), Preview::Text { ref text, truncated: false, .. } if text == "héllo"));
        assert!(matches!(preview(&root.join("pic.png")).unwrap(), Preview::Image { ref data_url, .. } if data_url.starts_with("data:image/png;base64,")));
        assert!(matches!(preview(&root.join("blob.bin")).unwrap(), Preview::None { .. }));
        assert!(matches!(preview(&root.join("empty.txt")).unwrap(), Preview::None { .. }));
        assert!(matches!(preview(&root.join("big.log")).unwrap(), Preview::Text { truncated: true, .. }));
        assert!(matches!(preview(&root).unwrap(), Preview::None { .. }));
        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn preview_serializes_with_camel_case_fields() {
        let v = serde_json::to_value(Preview::Image { data_url: "d".into(), size: 1 }).unwrap();
        assert_eq!(v["kind"], "image");
        assert_eq!(v["dataUrl"], "d");
    }

    #[test]
    fn protects_roots_and_requires_confirmation() {
        assert!(is_protected(Path::new("/")));
        assert!(is_protected(Path::new("/tmp")));
        assert!(!is_protected(Path::new("/tmp/some/file.txt")));
        let err = trash_paths(&["/tmp/x".into()], false).unwrap_err().to_string();
        assert!(err.contains("confirmation"));
        assert!(trash_paths(&[], true).is_err());
        assert!(trash_paths(&["relative.txt".into()], true).is_err());
        let root = tmp("protect");
        assert!(trash_paths(&[path_string(Path::new("/"))], true).is_err());
        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn favorites_recents_and_collections() {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        migrate(&c).unwrap();
        let root = tmp("coll");
        folder_add(&c, &root, Some("  Work  ")).unwrap();
        folder_add(&c, &root, None).unwrap();
        let favs = folder_list(&c).unwrap();
        assert_eq!(favs.len(), 1);
        assert!(favs[0].exists);
        folder_remove(&c, &path_string(&root)).unwrap();
        assert!(folder_list(&c).unwrap().is_empty());

        let f = root.join("a.txt");
        write(&f, b"hello");
        recent_add(&c, &f).unwrap();
        recent_add(&c, &f).unwrap();
        assert_eq!(recent_list(&c, 10).unwrap().len(), 1);
        recent_clear(&c).unwrap();
        assert!(recent_list(&c, 10).unwrap().is_empty());

        let col = collection_create(&c, " Project X ").unwrap();
        assert!(collection_create(&c, "").is_err());
        assert_eq!(collection_add(&c, &col.id, &[f.clone(), f.clone()]).unwrap(), 1, "duplicates ignored");
        assert!(collection_add(&c, "missing", &[f.clone()]).is_err());
        let items = collection_items(&c, &col.id).unwrap();
        assert_eq!(items[0].size, 5);
        assert_eq!(collection_list(&c).unwrap()[0].count, 1);
        fs::remove_file(&f).unwrap();
        assert!(!collection_items(&c, &col.id).unwrap()[0].exists, "missing files are flagged, not hidden");
        collection_rename(&c, &col.id, "Renamed").unwrap();
        collection_remove(&c, &col.id, &path_string(&f)).unwrap();
        collection_delete(&c, &col.id).unwrap();
        assert!(collection_list(&c).unwrap().is_empty());
        fs::remove_dir_all(root).ok();
    }
}
