//! ORBIT backend: discovering installed apps, storing them, and launching them.
//!
//! Security model: the UI never sends a path to run. It sends an app `id`; the
//! target is looked up in SQLite. Targets come either from Windows' own Start
//! menu list or from a custom executable the user picked, which is validated
//! (absolute path, existing file, `.exe` or `.lnk`) before it is stored and
//! again before it is launched.
//!
//! No dependency on Tauri, so everything here is unit-tested.

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::error::AppError;
use crate::state::now_ms;

pub const CATEGORIES: &[&str] = &[
    "Games",
    "Development",
    "Browsers",
    "Communication",
    "Media",
    "Productivity",
    "Utilities",
    "Other",
];

pub const KIND_START: &str = "start";
pub const KIND_CUSTOM: &str = "custom";

// ───────────────────────────── discovery ─────────────────────────────

#[derive(Debug, Clone, PartialEq)]
pub struct Discovered {
    pub name: String,
    /// Application User Model ID (or path) as reported by `Get-StartApps`.
    pub app_id: String,
}

/// Parses the JSON printed by `Get-StartApps | ConvertTo-Json`.
/// PowerShell prints a bare object (not an array) when there is exactly one app.
pub fn parse_start_apps(raw: &str) -> Result<Vec<Discovered>, AppError> {
    let text = raw.trim().trim_start_matches('\u{feff}').trim();
    if text.is_empty() {
        return Ok(vec![]);
    }
    let value: serde_json::Value = serde_json::from_str(text)
        .map_err(|e| AppError::Invalid(format!("Could not read the installed-app list: {e}")))?;
    let items = match value {
        serde_json::Value::Array(a) => a,
        obj @ serde_json::Value::Object(_) => vec![obj],
        _ => vec![],
    };

    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for item in items {
        let name = item.get("Name").and_then(|v| v.as_str()).unwrap_or("").trim();
        let app_id = item.get("AppID").and_then(|v| v.as_str()).unwrap_or("").trim();
        if name.is_empty() || app_id.is_empty() || name.len() > 200 || app_id.len() > 1024 {
            continue;
        }
        if seen.insert(app_id.to_lowercase()) {
            out.push(Discovered {
                name: name.to_string(),
                app_id: app_id.to_string(),
            });
        }
    }
    out.sort_by_key(|d| d.name.to_lowercase());
    Ok(out)
}

/// Everything the Start menu shows (desktop apps and Store apps alike).
#[cfg(windows)]
pub fn discover() -> Result<Vec<Discovered>, AppError> {
    use std::os::windows::process::CommandExt;
    let output = std::process::Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; Get-StartApps | Select-Object Name,AppID | ConvertTo-Json -Compress",
        ])
        .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
        .output()?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Invalid(format!(
            "Windows could not list installed apps: {}",
            err.trim()
        )));
    }
    parse_start_apps(&String::from_utf8_lossy(&output.stdout))
}

#[cfg(not(windows))]
pub fn discover() -> Result<Vec<Discovered>, AppError> {
    Err(AppError::Invalid(
        "Installed-app discovery is only available on Windows.".into(),
    ))
}

// ───────────────────────────── categories ─────────────────────────────

/// First-pass category from the app's name. Users can override it; once they
/// do, a rescan never changes it back (`category_locked`).
pub fn categorize(name: &str) -> &'static str {
    let n = name.to_lowercase();
    let tokens: Vec<&str> = n.split(|c: char| !c.is_alphanumeric()).filter(|t| !t.is_empty()).collect();
    // Phrases (with a space, dot or dash) match as substrings. Single words match
    // whole words, or word prefixes for longer keywords — so "git" does not match
    // "Digital" and "rust" does not match "Trust".
    let has = |words: &[&str]| {
        words.iter().any(|w| {
            if w.contains(|c: char| !c.is_alphanumeric()) {
                n.contains(w)
            } else {
                tokens.iter().any(|t| t == w || (w.len() >= 5 && t.starts_with(w)))
            }
        })
    };

    if has(&["steam", "epic games", "battle.net", "riot", "valorant", "league of legends", "minecraft", "roblox player", "origin", "ubisoft", "gog galaxy", "xbox", "ea app", "rockstar", "fortnite", "game"]) && !has(&["roblox studio"]) {
        "Games"
    } else if has(&["visual studio", "vs code", "code -", "roblox studio", "git", "node", "python", "android studio", "intellij", "pycharm", "webstorm", "rider", "docker", "postman", "terminal", "powershell", "command prompt", "wsl", "ubuntu", "sublime", "notepad++", "cursor", "unity", "unreal", "godot", "rust", "visual studio code"]) || n == "code" {
        "Development"
    } else if has(&["chrome", "firefox", "edge", "opera", "brave", "vivaldi", "browser", "safari", "tor browser"]) {
        "Browsers"
    } else if has(&["discord", "slack", "teams", "zoom", "skype", "telegram", "whatsapp", "signal", "messenger", "outlook", "mail", "thunderbird", "viber"]) {
        "Communication"
    } else if has(&["spotify", "vlc", "media player", "music", "itunes", "obs", "photos", "video", "audio", "premiere", "photoshop", "illustrator", "davinci", "audacity", "gimp", "blender", "paint", "camera", "movies", "podcast", "netflix", "youtube"]) {
        "Media"
    } else if has(&["word", "excel", "powerpoint", "onenote", "office", "notion", "obsidian", "calendar", "sticky", "notes", "todo", "to do", "adobe acrobat", "pdf", "libreoffice", "onedrive", "dropbox", "google drive", "sheets", "docs"]) {
        "Productivity"
    } else if has(&["settings", "control panel", "task manager", "calculator", "snipping", "device manager", "registry", "services", "7-zip", "winrar", "winzip", "uninstall", "cleanup", "disk", "defender", "security", "recovery", "system", "windows tools", "character map", "magnifier", "remote desktop", "resource monitor", "event viewer", "file explorer", "clock", "weather", "maps"]) {
        "Utilities"
    } else {
        "Other"
    }
}

fn valid_category(c: &str) -> bool {
    CATEGORIES.contains(&c)
}

// ───────────────────────────── custom apps ─────────────────────────────

/// Validates a user-picked program: absolute, existing file, `.exe` or `.lnk`.
pub fn validate_custom_path(raw: &str) -> Result<PathBuf, AppError> {
    let trimmed = raw.trim().trim_matches('"');
    if trimmed.is_empty() || trimmed.len() > 520 {
        return Err(AppError::Invalid("Choose a valid file.".into()));
    }
    let path = PathBuf::from(trimmed);
    if !path.is_absolute() {
        return Err(AppError::Invalid("Use the full path to the program.".into()));
    }
    if !path.is_file() {
        return Err(AppError::Invalid("That file does not exist.".into()));
    }
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    if ext != "exe" && ext != "lnk" {
        return Err(AppError::Invalid(
            "Only programs (.exe) and shortcuts (.lnk) can be added.".into(),
        ));
    }
    Ok(path)
}

static CUSTOM_COUNTER: AtomicU64 = AtomicU64::new(0);

fn custom_id() -> String {
    format!(
        "custom:{:x}{:x}",
        now_ms(),
        CUSTOM_COUNTER.fetch_add(1, Ordering::Relaxed)
    )
}

fn name_from_path(path: &Path) -> String {
    path.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Application")
        .to_string()
}

// ───────────────────────────── launching ─────────────────────────────

/// Starts the app and returns immediately (never waits for it to exit).
#[cfg(windows)]
pub fn launch(kind: &str, target: &str) -> Result<(), AppError> {
    use std::process::Command;
    match kind {
        KIND_START => {
            if target.is_empty() || target.len() > 1024 || target.contains('\0') {
                return Err(AppError::Invalid("This app has no launch target.".into()));
            }
            Command::new("explorer.exe")
                .arg(format!("shell:AppsFolder\\{target}"))
                .spawn()?;
            Ok(())
        }
        KIND_CUSTOM => {
            let path = validate_custom_path(target)?;
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.to_ascii_lowercase())
                .unwrap_or_default();
            if ext == "lnk" {
                Command::new("explorer.exe").arg(&path).spawn()?;
            } else {
                let mut cmd = Command::new(&path);
                if let Some(dir) = path.parent() {
                    cmd.current_dir(dir);
                }
                cmd.spawn()?;
            }
            Ok(())
        }
        _ => Err(AppError::Invalid("Unknown app type.".into())),
    }
}

#[cfg(not(windows))]
pub fn launch(_kind: &str, _target: &str) -> Result<(), AppError> {
    Err(AppError::Invalid("Launching apps is only available on Windows.".into()))
}

// ───────────────────────────── storage ─────────────────────────────

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppRecord {
    pub id: String,
    pub name: String,
    pub kind: String,
    /// Full path for custom apps; empty for Start-menu apps (internal ID).
    pub path: String,
    pub category: String,
    pub category_locked: bool,
    pub icon: Option<String>,
    pub favorite: bool,
    pub hidden: bool,
    pub launch_count: i64,
    pub last_launched: Option<i64>,
}

/// Replaces the set of Start-menu apps with a fresh scan. Apps that vanished
/// are marked not-present (their favorites and history return if they come
/// back); user choices (category, icon, favorite, hidden) are never overwritten.
/// Returns how many apps are present after the scan.
pub fn sync_discovered(conn: &Connection, found: &[Discovered]) -> Result<usize, AppError> {
    let tx = conn.unchecked_transaction()?;
    tx.execute("UPDATE apps SET present = 0 WHERE kind = ?1", params![KIND_START])?;
    let now = now_ms() as i64;
    for d in found {
        let id = format!("{KIND_START}:{}", d.app_id.to_lowercase());
        tx.execute(
            "INSERT INTO apps (id, name, kind, target, category, added_at, present)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)
             ON CONFLICT(id) DO UPDATE SET
               name = excluded.name,
               target = excluded.target,
               present = 1,
               category = CASE WHEN apps.category_locked = 1 THEN apps.category ELSE excluded.category END",
            params![id, d.name, KIND_START, d.app_id, categorize(&d.name), now],
        )?;
    }
    let present: i64 = tx.query_row("SELECT COUNT(*) FROM apps WHERE present = 1", [], |r| r.get(0))?;
    tx.commit()?;
    Ok(present as usize)
}

pub fn list(conn: &Connection) -> Result<Vec<AppRecord>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, kind, target, category, category_locked, icon, favorite, hidden, launch_count, last_launched
         FROM apps WHERE present = 1 ORDER BY name COLLATE NOCASE",
    )?;
    let rows = stmt.query_map([], |r| {
        let kind: String = r.get(2)?;
        let target: String = r.get(3)?;
        Ok(AppRecord {
            id: r.get(0)?,
            name: r.get(1)?,
            path: if kind == KIND_CUSTOM { target } else { String::new() },
            kind,
            category: r.get(4)?,
            category_locked: r.get::<_, i64>(5)? != 0,
            icon: r.get(6)?,
            favorite: r.get::<_, i64>(7)? != 0,
            hidden: r.get::<_, i64>(8)? != 0,
            launch_count: r.get(9)?,
            last_launched: r.get(10)?,
        })
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

fn require_changed(changed: usize) -> Result<(), AppError> {
    if changed == 0 {
        Err(AppError::Invalid("That app no longer exists.".into()))
    } else {
        Ok(())
    }
}

pub fn set_favorite(conn: &Connection, id: &str, favorite: bool) -> Result<(), AppError> {
    let n = conn.execute("UPDATE apps SET favorite = ?2 WHERE id = ?1", params![id, favorite as i64])?;
    require_changed(n)
}

pub fn set_hidden(conn: &Connection, id: &str, hidden: bool) -> Result<(), AppError> {
    let n = conn.execute("UPDATE apps SET hidden = ?2 WHERE id = ?1", params![id, hidden as i64])?;
    require_changed(n)
}

pub fn set_category(conn: &Connection, id: &str, category: &str) -> Result<(), AppError> {
    if !valid_category(category) {
        return Err(AppError::Invalid("Unknown category.".into()));
    }
    let n = conn.execute(
        "UPDATE apps SET category = ?2, category_locked = 1 WHERE id = ?1",
        params![id, category],
    )?;
    require_changed(n)
}

pub fn set_icon(conn: &Connection, id: &str, icon: Option<&str>) -> Result<(), AppError> {
    if let Some(i) = icon {
        let ok = !i.is_empty() && i.len() <= 32 && i.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
        if !ok {
            return Err(AppError::Invalid("Invalid icon.".into()));
        }
    }
    let n = conn.execute("UPDATE apps SET icon = ?2 WHERE id = ?1", params![id, icon])?;
    require_changed(n)
}

pub fn rename(conn: &Connection, id: &str, name: &str) -> Result<(), AppError> {
    let name = name.trim();
    if name.is_empty() || name.len() > 100 {
        return Err(AppError::Invalid("Name must be 1–100 characters.".into()));
    }
    let n = conn.execute("UPDATE apps SET name = ?2 WHERE id = ?1 AND kind = ?3", params![id, name, KIND_CUSTOM])?;
    require_changed(n)
}

pub fn add_custom(conn: &Connection, name: Option<&str>, path: &str, category: &str) -> Result<AppRecord, AppError> {
    let valid = validate_custom_path(path)?;
    if !valid_category(category) {
        return Err(AppError::Invalid("Unknown category.".into()));
    }
    let name = match name.map(str::trim).filter(|n| !n.is_empty()) {
        Some(n) if n.len() <= 100 => n.to_string(),
        Some(_) => return Err(AppError::Invalid("Name must be 1–100 characters.".into())),
        None => name_from_path(&valid),
    };
    let target = valid.to_string_lossy().to_string();

    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM apps WHERE kind = ?1 AND lower(target) = lower(?2)",
            params![KIND_CUSTOM, target],
            |r| r.get(0),
        )
        .optional()?;
    if existing.is_some() {
        return Err(AppError::Invalid("That program is already in Orbit.".into()));
    }

    let id = custom_id();
    conn.execute(
        "INSERT INTO apps (id, name, kind, target, category, category_locked, added_at, present)
         VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, 1)",
        params![id, name, KIND_CUSTOM, target, category, now_ms() as i64],
    )?;
    list(conn)?
        .into_iter()
        .find(|a| a.id == id)
        .ok_or_else(|| AppError::Invalid("Could not save the app.".into()))
}

/// Only custom apps can be deleted. Start-menu apps are hidden instead,
/// because a rescan would bring them straight back.
pub fn remove_custom(conn: &Connection, id: &str) -> Result<(), AppError> {
    let n = conn.execute("DELETE FROM apps WHERE id = ?1 AND kind = ?2", params![id, KIND_CUSTOM])?;
    require_changed(n)
}

pub fn launch_target(conn: &Connection, id: &str) -> Result<(String, String), AppError> {
    conn.query_row(
        "SELECT kind, target FROM apps WHERE id = ?1 AND present = 1",
        params![id],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )
    .optional()?
    .ok_or_else(|| AppError::Invalid("That app no longer exists.".into()))
}

pub fn record_launch(conn: &Connection, id: &str) -> Result<(), AppError> {
    conn.execute(
        "UPDATE apps SET launch_count = launch_count + 1, last_launched = ?2 WHERE id = ?1",
        params![id, now_ms() as i64],
    )?;
    Ok(())
}

// ───────────────────────────── tests ─────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    fn conn() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        db::migrate(&c).unwrap();
        c
    }

    fn found(names: &[(&str, &str)]) -> Vec<Discovered> {
        names
            .iter()
            .map(|(n, i)| Discovered { name: n.to_string(), app_id: i.to_string() })
            .collect()
    }

    #[test]
    fn parses_array_and_single_object() {
        let arr = r#"[{"Name":"Calculator","AppID":"Microsoft.WindowsCalculator_8wekyb3d8bbwe!App"},{"Name":"Discord","AppID":"com.squirrel.Discord.Discord"}]"#;
        let apps = parse_start_apps(arr).unwrap();
        assert_eq!(apps.len(), 2);
        assert_eq!(apps[0].name, "Calculator");

        let one = r#"{"Name":"Only","AppID":"x"}"#;
        assert_eq!(parse_start_apps(one).unwrap().len(), 1);
        assert!(parse_start_apps("").unwrap().is_empty());
    }

    #[test]
    fn parse_strips_bom_dedupes_and_rejects_garbage() {
        let dup = "\u{feff}[{\"Name\":\"A\",\"AppID\":\"id1\"},{\"Name\":\"A copy\",\"AppID\":\"ID1\"},{\"Name\":\"\",\"AppID\":\"id2\"}]";
        assert_eq!(parse_start_apps(dup).unwrap().len(), 1);
        assert!(parse_start_apps("not json").is_err());
    }

    #[test]
    fn categorizes_common_apps() {
        assert_eq!(categorize("Steam"), "Games");
        assert_eq!(categorize("Discord"), "Communication");
        assert_eq!(categorize("Google Chrome"), "Browsers");
        assert_eq!(categorize("Roblox Studio"), "Development");
        assert_eq!(categorize("Visual Studio Code"), "Development");
        assert_eq!(categorize("Spotify"), "Media");
        assert_eq!(categorize("Calculator"), "Utilities");
        assert_eq!(categorize("Totally Unknown Thing"), "Other");
    }

    #[test]
    fn sync_keeps_user_choices_and_marks_missing() {
        let c = conn();
        sync_discovered(&c, &found(&[("Discord", "d"), ("Steam", "s")])).unwrap();
        let id = "start:d";
        set_favorite(&c, id, true).unwrap();
        set_category(&c, id, "Games").unwrap();
        record_launch(&c, id).unwrap();

        // Steam disappears, Discord stays, Notepad appears.
        let n = sync_discovered(&c, &found(&[("Discord", "d"), ("Notepad", "n")])).unwrap();
        assert_eq!(n, 2);
        let apps = list(&c).unwrap();
        let d = apps.iter().find(|a| a.id == id).unwrap();
        assert!(d.favorite);
        assert_eq!(d.category, "Games"); // locked: not reset to Communication
        assert_eq!(d.launch_count, 1);
        assert!(!apps.iter().any(|a| a.name == "Steam"));

        // Steam comes back: history is still there.
        sync_discovered(&c, &found(&[("Steam", "s")])).unwrap();
        assert!(list(&c).unwrap().iter().any(|a| a.name == "Steam"));
    }

    #[test]
    fn rejects_bad_input() {
        let c = conn();
        sync_discovered(&c, &found(&[("A", "a")])).unwrap();
        assert!(set_category(&c, "start:a", "Nope").is_err());
        assert!(set_icon(&c, "start:a", Some("../etc")).is_err());
        assert!(set_favorite(&c, "missing", true).is_err());
        assert!(set_icon(&c, "start:a", Some("gamepad-2")).is_ok());
        assert!(rename(&c, "start:a", "Renamed").is_err()); // only custom apps can be renamed
    }

    #[test]
    fn custom_app_lifecycle_and_path_validation() {
        let c = conn();
        let dir = std::env::temp_dir().join("noir_apps_test");
        std::fs::create_dir_all(&dir).unwrap();
        let exe = dir.join("tool.exe");
        std::fs::write(&exe, b"x").unwrap();
        let txt = dir.join("notes.txt");
        std::fs::write(&txt, b"x").unwrap();

        assert!(add_custom(&c, None, "relative.exe", "Other").is_err());
        assert!(add_custom(&c, None, dir.join("missing.exe").to_str().unwrap(), "Other").is_err());
        assert!(add_custom(&c, None, txt.to_str().unwrap(), "Other").is_err());
        assert!(add_custom(&c, None, exe.to_str().unwrap(), "Bogus").is_err());

        let app = add_custom(&c, None, exe.to_str().unwrap(), "Utilities").unwrap();
        assert_eq!(app.name, "tool");
        assert_eq!(app.kind, KIND_CUSTOM);
        assert!(add_custom(&c, None, exe.to_str().unwrap(), "Utilities").is_err()); // duplicate

        rename(&c, &app.id, "My Tool").unwrap();
        let (kind, target) = launch_target(&c, &app.id).unwrap();
        assert_eq!(kind, KIND_CUSTOM);
        assert!(target.ends_with("tool.exe"));

        remove_custom(&c, &app.id).unwrap();
        assert!(launch_target(&c, &app.id).is_err());
    }
}
