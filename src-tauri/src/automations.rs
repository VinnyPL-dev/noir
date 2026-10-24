//! AUTOMATIONS — optional, local, permissioned.
//!
//! An automation belongs to a Space and runs when the user switches to it.
//! It can only combine four built-in actions (launch an Orbit app, open a
//! folder, open a project, open a web link). There is no scripting, no shell,
//! and nothing is ever downloaded or executed from the internet.
//!
//! Permission layers, all enforced here in Rust (never trusted from the UI):
//!   1. a master switch (off by default)
//!   2. one switch per action type (all off by default)
//!   3. a per-automation "enabled" flag for automatic runs

use std::thread::sleep;
use std::time::Duration;

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use crate::apps;
use crate::db::Database;
use crate::error::AppError;
use crate::flow;
use crate::shell;
use crate::state::{new_id, now_ms};

pub const KEY_MASTER: &str = "automations.enabled";
pub const KEY_APPS: &str = "automations.allowApps";
pub const KEY_FOLDERS: &str = "automations.allowFolders";
pub const KEY_URLS: &str = "automations.allowUrls";

const MAX_ACTIONS: usize = 12;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum Action {
    LaunchApp { app_id: String },
    OpenFolder { path: String },
    OpenProject { project_id: String },
    OpenUrl { url: String },
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Automation {
    pub id: String,
    pub name: String,
    pub space_id: String,
    pub actions: Vec<Action>,
    pub enabled: bool,
    pub created_at: i64,
    pub last_run: Option<i64>,
}

#[derive(Serialize, Debug, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Permissions {
    pub master: bool,
    pub apps: bool,
    pub folders: bool,
    pub urls: bool,
}

pub fn permissions(conn: &Connection) -> Result<Permissions, AppError> {
    let flag = |key: &str| -> Result<bool, AppError> {
        match conn.query_row("SELECT value FROM settings WHERE key = ?1", params![key], |r| r.get::<_, String>(0)) {
            Ok(v) => Ok(v == "1"),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(false),
            Err(e) => Err(e.into()),
        }
    };
    Ok(Permissions { master: flag(KEY_MASTER)?, apps: flag(KEY_APPS)?, folders: flag(KEY_FOLDERS)?, urls: flag(KEY_URLS)? })
}

/// Pure permission check for one action.
pub fn check_permission(action: &Action, perms: &Permissions) -> Result<(), String> {
    let (allowed, what) = match action {
        Action::LaunchApp { .. } => (perms.apps, "Launching apps"),
        Action::OpenFolder { .. } | Action::OpenProject { .. } => (perms.folders, "Opening folders and projects"),
        Action::OpenUrl { .. } => (perms.urls, "Opening web links"),
    };
    if allowed {
        Ok(())
    } else {
        Err(format!("{what} is switched off in Settings → Automations."))
    }
}

pub fn validate_actions(actions: &[Action]) -> Result<(), AppError> {
    if actions.is_empty() {
        return Err(AppError::Invalid("Add at least one action.".into()));
    }
    if actions.len() > MAX_ACTIONS {
        return Err(AppError::Invalid(format!("An automation can have up to {MAX_ACTIONS} actions.")));
    }
    for a in actions {
        match a {
            Action::LaunchApp { app_id } if app_id.is_empty() || app_id.len() > 200 => {
                return Err(AppError::Invalid("Choose an app.".into()))
            }
            Action::OpenFolder { path } if path.trim().is_empty() || path.len() > 4096 => {
                return Err(AppError::Invalid("Choose a folder.".into()))
            }
            Action::OpenProject { project_id } if project_id.is_empty() => {
                return Err(AppError::Invalid("Choose a project.".into()))
            }
            Action::OpenUrl { url } => {
                shell::validate_url(url)?;
            }
            _ => {}
        }
    }
    Ok(())
}

fn parse_actions(raw: &str) -> Vec<Action> {
    serde_json::from_str(raw).unwrap_or_default()
}

fn map_row(r: &rusqlite::Row) -> rusqlite::Result<Automation> {
    Ok(Automation {
        id: r.get(0)?,
        name: r.get(1)?,
        space_id: r.get(2)?,
        actions: parse_actions(&r.get::<_, String>(3)?),
        enabled: r.get::<_, i64>(4)? != 0,
        created_at: r.get(5)?,
        last_run: r.get(6)?,
    })
}

const COLS: &str = "id, name, space_id, actions, enabled, created_at, last_run";

pub fn list(conn: &Connection) -> Result<Vec<Automation>, AppError> {
    let mut stmt = conn.prepare(&format!("SELECT {COLS} FROM automations ORDER BY created_at"))?;
    let rows = stmt.query_map([], map_row)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn get(conn: &Connection, id: &str) -> Result<Automation, AppError> {
    conn.query_row(&format!("SELECT {COLS} FROM automations WHERE id = ?1"), params![id], map_row)
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::Invalid("That automation no longer exists.".into()),
            other => other.into(),
        })
}

fn clean_name(name: &str) -> Result<String, AppError> {
    let n = name.trim();
    if n.is_empty() || n.chars().count() > 60 {
        return Err(AppError::Invalid("Give the automation a name (up to 60 characters).".into()));
    }
    Ok(n.to_string())
}

fn space_exists(conn: &Connection, id: &str) -> Result<(), AppError> {
    let n: i64 = conn.query_row("SELECT COUNT(*) FROM spaces WHERE id = ?1", params![id], |r| r.get(0))?;
    if n == 0 {
        return Err(AppError::Invalid("That space no longer exists.".into()));
    }
    Ok(())
}

/// New automations start **disabled**; the user turns them on deliberately.
pub fn create(conn: &Connection, name: &str, space_id: &str, actions: &[Action]) -> Result<Automation, AppError> {
    let name = clean_name(name)?;
    validate_actions(actions)?;
    space_exists(conn, space_id)?;
    let id = new_id("auto");
    let json = serde_json::to_string(actions).map_err(|_| AppError::Invalid("Could not save actions.".into()))?;
    conn.execute(
        "INSERT INTO automations (id, name, space_id, actions, enabled, created_at) VALUES (?1, ?2, ?3, ?4, 0, ?5)",
        params![id, name, space_id, json, now_ms() as i64],
    )?;
    get(conn, &id)
}

pub fn update(conn: &Connection, id: &str, name: &str, space_id: &str, actions: &[Action]) -> Result<Automation, AppError> {
    let name = clean_name(name)?;
    validate_actions(actions)?;
    space_exists(conn, space_id)?;
    let json = serde_json::to_string(actions).map_err(|_| AppError::Invalid("Could not save actions.".into()))?;
    let n = conn.execute(
        "UPDATE automations SET name = ?2, space_id = ?3, actions = ?4 WHERE id = ?1",
        params![id, name, space_id, json],
    )?;
    if n == 0 {
        return Err(AppError::Invalid("That automation no longer exists.".into()));
    }
    get(conn, id)
}

pub fn set_enabled(conn: &Connection, id: &str, enabled: bool) -> Result<(), AppError> {
    let n = conn.execute("UPDATE automations SET enabled = ?2 WHERE id = ?1", params![id, enabled as i64])?;
    if n == 0 {
        return Err(AppError::Invalid("That automation no longer exists.".into()));
    }
    Ok(())
}

pub fn delete(conn: &Connection, id: &str) -> Result<(), AppError> {
    conn.execute("DELETE FROM automations WHERE id = ?1", params![id])?;
    Ok(())
}

/// Automations that should run automatically when entering `space_id`.
/// Returns nothing when the master switch is off.
pub fn due_for_space(conn: &Connection, space_id: &str) -> Result<Vec<Automation>, AppError> {
    if !permissions(conn)?.master {
        return Ok(vec![]);
    }
    Ok(list(conn)?.into_iter().filter(|a| a.space_id == space_id && a.enabled).collect())
}

// ───────────────────────────── running ─────────────────────────────

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ActionResult {
    pub label: String,
    pub ok: bool,
    pub detail: Option<String>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RunReport {
    pub automation_id: String,
    pub name: String,
    pub results: Vec<ActionResult>,
}

fn run_action(db: &Database, action: &Action) -> Result<String, AppError> {
    match action {
        Action::LaunchApp { app_id } => {
            let (kind, target) = db.with(|c| apps::launch_target(c, app_id))?;
            apps::launch(&kind, &target)?;
            db.with(|c| apps::record_launch(c, app_id))?;
            Ok("Launched app".into())
        }
        Action::OpenFolder { path } => {
            let dir = shell::existing_dir(path)?;
            shell::open_folder(&dir)?;
            Ok(format!("Opened {}", dir.display()))
        }
        Action::OpenProject { project_id } => {
            let path = db
                .with(|c| flow::project_path(c, project_id))?
                .ok_or_else(|| AppError::Invalid("That project has no folder.".into()))?;
            let dir = shell::existing_dir(&path)?;
            shell::open_folder(&dir)?;
            db.with(|c| flow::project_touch(c, project_id))?;
            Ok(format!("Opened {}", dir.display()))
        }
        Action::OpenUrl { url } => {
            shell::open_url(url)?;
            Ok("Opened link".into())
        }
    }
}

fn label_of(db: &Database, action: &Action) -> String {
    match action {
        Action::LaunchApp { app_id } => db
            .with(|c| apps::launch_target(c, app_id).map(|_| ()))
            .ok()
            .and_then(|_| db.with(|c| apps::list(c)).ok())
            .and_then(|all| all.into_iter().find(|a| a.id == *app_id).map(|a| format!("Launch {}", a.name)))
            .unwrap_or_else(|| "Launch app".into()),
        Action::OpenFolder { path } => format!("Open {path}"),
        Action::OpenProject { project_id } => db
            .with(|c| flow::project_list(c))
            .ok()
            .and_then(|all| all.into_iter().find(|p| p.id == *project_id).map(|p| format!("Open project {}", p.name)))
            .unwrap_or_else(|| "Open project".into()),
        Action::OpenUrl { url } => format!("Open {url}"),
    }
}

/// Runs an automation's actions in order, honouring the permission switches.
/// Every run (and every refusal) is written to the activity log.
pub fn run(db: &Database, automation: &Automation) -> Result<RunReport, AppError> {
    let perms = db.with(permissions)?;
    let mut results = Vec::new();
    for (i, action) in automation.actions.iter().enumerate() {
        let label = label_of(db, action);
        let outcome = match check_permission(action, &perms) {
            Err(why) => Err(why),
            Ok(()) => run_action(db, action).map_err(|e| e.to_string()),
        };
        results.push(match outcome {
            Ok(detail) => ActionResult { label, ok: true, detail: Some(detail) },
            Err(why) => ActionResult { label, ok: false, detail: Some(why) },
        });
        if i + 1 < automation.actions.len() {
            sleep(Duration::from_millis(300)); // don't start everything in the same instant
        }
    }
    let ok = results.iter().all(|r| r.ok);
    let detail = results
        .iter()
        .map(|r| format!("{} {}", if r.ok { "✓" } else { "✗" }, r.label))
        .collect::<Vec<_>>()
        .join("; ");
    db.with(|c| {
        c.execute("UPDATE automations SET last_run = ?2 WHERE id = ?1", params![automation.id, now_ms() as i64])?;
        c.execute(
            "INSERT INTO automation_log (automation_id, name, ran_at, ok, detail) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![automation.id, automation.name, now_ms() as i64, ok as i64, detail],
        )?;
        c.execute("DELETE FROM automation_log WHERE id NOT IN (SELECT id FROM automation_log ORDER BY id DESC LIMIT 200)", [])?;
        Ok(())
    })?;
    Ok(RunReport { automation_id: automation.id.clone(), name: automation.name.clone(), results })
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    pub id: i64,
    pub automation_id: String,
    pub name: String,
    pub ran_at: i64,
    pub ok: bool,
    pub detail: String,
}

pub fn log_list(conn: &Connection, limit: i64) -> Result<Vec<LogEntry>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, automation_id, name, ran_at, ok, detail FROM automation_log ORDER BY id DESC LIMIT ?1",
    )?;
    let rows = stmt.query_map(params![limit.clamp(1, 200)], |r| {
        Ok(LogEntry { id: r.get(0)?, automation_id: r.get(1)?, name: r.get(2)?, ran_at: r.get(3)?, ok: r.get::<_, i64>(4)? != 0, detail: r.get(5)? })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn log_clear(conn: &Connection) -> Result<(), AppError> {
    conn.execute("DELETE FROM automation_log", [])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrate;
    use crate::spaces;

    fn conn() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        migrate(&c).unwrap();
        c
    }
    fn set(c: &Connection, key: &str, v: &str) {
        c.execute("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?1, ?2, 0)", params![key, v]).unwrap();
    }

    #[test]
    fn everything_is_off_by_default() {
        let c = conn();
        assert_eq!(permissions(&c).unwrap(), Permissions::default());
        let space = spaces::list(&c).unwrap()[0].id.clone();
        let a = create(&c, "Dev", &space, &[Action::OpenFolder { path: "C:\\dev".into() }]).unwrap();
        assert!(!a.enabled, "new automations start disabled");
        set_enabled(&c, &a.id, true).unwrap();
        assert!(due_for_space(&c, &space).unwrap().is_empty(), "master switch off means nothing is due");
        set(&c, KEY_MASTER, "1");
        assert_eq!(due_for_space(&c, &space).unwrap().len(), 1);
        set_enabled(&c, &a.id, false).unwrap();
        assert!(due_for_space(&c, &space).unwrap().is_empty());
        assert!(due_for_space(&c, "other-space").unwrap().is_empty());
    }

    #[test]
    fn each_action_type_has_its_own_permission() {
        let mut p = Permissions { master: true, ..Default::default() };
        let launch = Action::LaunchApp { app_id: "x".into() };
        let folder = Action::OpenFolder { path: "C:\\".into() };
        let project = Action::OpenProject { project_id: "p".into() };
        let url = Action::OpenUrl { url: "https://a.com".into() };
        for a in [&launch, &folder, &project, &url] {
            assert!(check_permission(a, &p).is_err());
        }
        p.apps = true;
        assert!(check_permission(&launch, &p).is_ok());
        assert!(check_permission(&folder, &p).is_err());
        p.folders = true;
        assert!(check_permission(&folder, &p).is_ok());
        assert!(check_permission(&project, &p).is_ok());
        assert!(check_permission(&url, &p).is_err());
        p.urls = true;
        assert!(check_permission(&url, &p).is_ok());
    }

    #[test]
    fn actions_are_validated() {
        assert!(validate_actions(&[]).is_err());
        assert!(validate_actions(&[Action::OpenUrl { url: "file:///C:/Windows/System32/cmd.exe".into() }]).is_err());
        assert!(validate_actions(&[Action::OpenUrl { url: "javascript:alert(1)".into() }]).is_err());
        assert!(validate_actions(&[Action::LaunchApp { app_id: "".into() }]).is_err());
        assert!(validate_actions(&[Action::OpenFolder { path: "  ".into() }]).is_err());
        assert!(validate_actions(&vec![Action::OpenProject { project_id: "p".into() }; MAX_ACTIONS + 1]).is_err());
        assert!(validate_actions(&[Action::OpenUrl { url: "https://example.com".into() }]).is_ok());
    }

    #[test]
    fn json_shape_matches_the_frontend_and_unknown_actions_are_rejected() {
        let v = serde_json::to_value(Action::LaunchApp { app_id: "a1".into() }).unwrap();
        assert_eq!(v["type"], "launchApp");
        assert_eq!(v["appId"], "a1");
        assert!(serde_json::from_str::<Action>("{\"type\":\"runScript\",\"script\":\"calc\"}").is_err());
        assert!(serde_json::from_str::<Action>("{\"type\":\"openProject\",\"projectId\":\"p\"}").is_ok());
    }

    #[test]
    fn deleting_a_space_removes_its_automations() {
        let c = conn();
        let first = spaces::list(&c).unwrap()[0].id.clone();
        let second = spaces::create(&c, "B", "grid", &[]).unwrap().id;
        let a = create(&c, "x", &second, &[Action::OpenUrl { url: "https://a.com".into() }]).unwrap();
        assert!(create(&c, "x", "missing", &[Action::OpenUrl { url: "https://a.com".into() }]).is_err());
        spaces::delete(&c, &second).unwrap();
        assert!(get(&c, &a.id).is_err());
        assert!(list(&c).unwrap().is_empty());
        let _ = first;
    }

    #[test]
    fn log_is_listed_newest_first_and_clearable() {
        let c = conn();
        for i in 0..3 {
            c.execute(
                "INSERT INTO automation_log (automation_id, name, ran_at, ok, detail) VALUES ('a', ?1, ?2, 1, 'ok')",
                params![format!("n{i}"), i],
            )
            .unwrap();
        }
        let log = log_list(&c, 2).unwrap();
        assert_eq!(log.len(), 2);
        assert_eq!(log[0].name, "n2");
        log_clear(&c).unwrap();
        assert!(log_list(&c, 10).unwrap().is_empty());
    }
}
