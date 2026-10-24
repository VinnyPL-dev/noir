//! SPACES — separate environments, each with its own dashboard layout,
//! shortcuts and preferences.

use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::shell;
use crate::state::{new_id, now_ms};

/// Icon keys the UI knows how to draw. Anything else is rejected.
pub const ICONS: &[&str] = &[
    "grid", "gamepad", "code", "coffee", "briefcase", "music", "palette", "book", "terminal", "rocket", "home", "star",
];
const MAX_SHORTCUTS: usize = 40;
const MAX_LAYOUT_BYTES: usize = 64 * 1024;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Shortcut {
    App { id: String },
    Folder { path: String, #[serde(default)] label: Option<String> },
    Url { url: String, #[serde(default)] label: Option<String> },
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Space {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub position: i64,
    /// JSON dashboard layout, or null to use the default.
    pub layout: Option<String>,
    /// JSON object of per-space preferences.
    pub prefs: String,
    pub shortcuts: Vec<Shortcut>,
    pub created_at: i64,
}

const COLS: &str = "id, name, icon, position, layout, prefs, shortcuts, created_at";

fn row(r: &Row) -> rusqlite::Result<Space> {
    let raw: String = r.get(6)?;
    Ok(Space {
        id: r.get(0)?,
        name: r.get(1)?,
        icon: r.get(2)?,
        position: r.get(3)?,
        layout: r.get(4)?,
        prefs: r.get(5)?,
        shortcuts: serde_json::from_str(&raw).unwrap_or_default(),
        created_at: r.get(7)?,
    })
}

fn clean_name(name: &str) -> Result<String, AppError> {
    let n = name.trim();
    if n.is_empty() || n.chars().count() > 40 {
        return Err(AppError::Invalid("Give the space a name (up to 40 characters).".into()));
    }
    Ok(n.to_string())
}

fn clean_icon(icon: &str) -> Result<String, AppError> {
    if ICONS.contains(&icon) {
        Ok(icon.to_string())
    } else {
        Err(AppError::Invalid("Unknown icon.".into()))
    }
}

fn changed(n: usize) -> Result<(), AppError> {
    if n == 0 {
        Err(AppError::Invalid("That space no longer exists.".into()))
    } else {
        Ok(())
    }
}

pub fn list(conn: &Connection) -> Result<Vec<Space>, AppError> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM spaces", [], |r| r.get(0))?;
    if count == 0 {
        conn.execute(
            "INSERT INTO spaces (id, name, icon, position, created_at) VALUES (?1, 'Everyday', 'home', 0, ?2)",
            params![new_id("space"), now_ms() as i64],
        )?;
    }
    let mut stmt = conn.prepare(&format!("SELECT {COLS} FROM spaces ORDER BY position, created_at"))?;
    let rows = stmt.query_map([], row)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

fn get(conn: &Connection, id: &str) -> Result<Space, AppError> {
    conn.query_row(&format!("SELECT {COLS} FROM spaces WHERE id = ?1"), params![id], row)
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::Invalid("That space no longer exists.".into()),
            other => other.into(),
        })
}

pub fn validate_shortcuts(items: &[Shortcut]) -> Result<(), AppError> {
    if items.len() > MAX_SHORTCUTS {
        return Err(AppError::Invalid(format!("A space can hold up to {MAX_SHORTCUTS} shortcuts.")));
    }
    for item in items {
        match item {
            Shortcut::App { id } if id.is_empty() || id.len() > 200 => {
                return Err(AppError::Invalid("Invalid app shortcut.".into()))
            }
            Shortcut::Folder { path, .. } if path.trim().is_empty() || path.len() > 4096 => {
                return Err(AppError::Invalid("Invalid folder shortcut.".into()))
            }
            Shortcut::Url { url, .. } => {
                shell::validate_url(url)?;
            }
            _ => {}
        }
    }
    Ok(())
}

pub fn create(conn: &Connection, name: &str, icon: &str, shortcuts: &[Shortcut]) -> Result<Space, AppError> {
    let name = clean_name(name)?;
    let icon = clean_icon(icon)?;
    validate_shortcuts(shortcuts)?;
    list(conn)?; // make sure the default exists before computing the position
    let position: i64 = conn.query_row("SELECT COALESCE(MAX(position), -1) + 1 FROM spaces", [], |r| r.get(0))?;
    let id = new_id("space");
    conn.execute(
        "INSERT INTO spaces (id, name, icon, position, shortcuts, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, name, icon, position, serde_json::to_string(shortcuts).unwrap_or_else(|_| "[]".into()), now_ms() as i64],
    )?;
    get(conn, &id)
}

pub fn update(conn: &Connection, id: &str, name: &str, icon: &str) -> Result<Space, AppError> {
    let name = clean_name(name)?;
    let icon = clean_icon(icon)?;
    changed(conn.execute("UPDATE spaces SET name = ?2, icon = ?3 WHERE id = ?1", params![id, name, icon])?)?;
    get(conn, id)
}

pub fn set_layout(conn: &Connection, id: &str, layout: Option<&str>) -> Result<(), AppError> {
    if let Some(l) = layout {
        if l.len() > MAX_LAYOUT_BYTES || serde_json::from_str::<serde_json::Value>(l).is_err() {
            return Err(AppError::Invalid("That layout isn't valid.".into()));
        }
    }
    changed(conn.execute("UPDATE spaces SET layout = ?2 WHERE id = ?1", params![id, layout])?)
}

pub fn set_prefs(conn: &Connection, id: &str, prefs: &str) -> Result<(), AppError> {
    let ok = prefs.len() <= 4096 && serde_json::from_str::<serde_json::Value>(prefs).map(|v| v.is_object()).unwrap_or(false);
    if !ok {
        return Err(AppError::Invalid("Those preferences aren't valid.".into()));
    }
    changed(conn.execute("UPDATE spaces SET prefs = ?2 WHERE id = ?1", params![id, prefs])?)
}

pub fn set_shortcuts(conn: &Connection, id: &str, items: &[Shortcut]) -> Result<(), AppError> {
    validate_shortcuts(items)?;
    let json = serde_json::to_string(items).map_err(|_| AppError::Invalid("Could not save shortcuts.".into()))?;
    changed(conn.execute("UPDATE spaces SET shortcuts = ?2 WHERE id = ?1", params![id, json])?)
}

/// The last remaining space can't be deleted. Its automations go with it.
pub fn delete(conn: &Connection, id: &str) -> Result<(), AppError> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM spaces", [], |r| r.get(0))?;
    if count <= 1 {
        return Err(AppError::Invalid("Keep at least one space.".into()));
    }
    changed(conn.execute("DELETE FROM spaces WHERE id = ?1", params![id])?)
}

pub fn reorder(conn: &Connection, ids: &[String]) -> Result<(), AppError> {
    for (i, id) in ids.iter().enumerate() {
        conn.execute("UPDATE spaces SET position = ?2 WHERE id = ?1", params![id, i as i64])?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrate;

    fn conn() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        migrate(&c).unwrap();
        c
    }

    #[test]
    fn seeds_one_default_space_once() {
        let c = conn();
        assert_eq!(list(&c).unwrap().len(), 1);
        assert_eq!(list(&c).unwrap().len(), 1);
        assert_eq!(list(&c).unwrap()[0].name, "Everyday");
    }

    #[test]
    fn create_update_validate_and_delete() {
        let c = conn();
        let g = create(&c, " Gaming ", "gamepad", &[Shortcut::App { id: "custom:1".into() }]).unwrap();
        assert_eq!(g.name, "Gaming");
        assert_eq!(g.position, 1);
        assert_eq!(g.shortcuts.len(), 1);
        assert!(create(&c, "  ", "grid", &[]).is_err());
        assert!(create(&c, "X", "skull", &[]).is_err());
        assert!(create(&c, &"x".repeat(41), "grid", &[]).is_err());
        let u = update(&c, &g.id, "Play", "rocket").unwrap();
        assert_eq!((u.name.as_str(), u.icon.as_str()), ("Play", "rocket"));
        delete(&c, &g.id).unwrap();
        assert!(delete(&c, &g.id).is_err());
        let only = list(&c).unwrap();
        assert!(delete(&c, &only[0].id).is_err(), "can't delete the last space");
    }

    #[test]
    fn layout_prefs_and_shortcuts_are_validated() {
        let c = conn();
        let id = list(&c).unwrap()[0].id.clone();
        set_layout(&c, &id, Some("[{\"id\":\"welcome\"}]")).unwrap();
        assert!(set_layout(&c, &id, Some("not json")).is_err());
        assert!(set_layout(&c, &id, Some(&"[".repeat(MAX_LAYOUT_BYTES + 1))).is_err());
        set_layout(&c, &id, None).unwrap();
        set_prefs(&c, &id, "{\"density\":\"compact\"}").unwrap();
        assert!(set_prefs(&c, &id, "[1]").is_err());
        assert!(set_prefs(&c, &id, "oops").is_err());
        let ok = [
            Shortcut::Folder { path: "C:\\dev".into(), label: None },
            Shortcut::Url { url: "https://example.com".into(), label: Some("Ex".into()) },
        ];
        set_shortcuts(&c, &id, &ok).unwrap();
        assert_eq!(list(&c).unwrap()[0].shortcuts, ok.to_vec());
        assert!(set_shortcuts(&c, &id, &[Shortcut::Url { url: "file:///C:/x.exe".into(), label: None }]).is_err());
        assert!(set_shortcuts(&c, &id, &[Shortcut::Folder { path: " ".into(), label: None }]).is_err());
        assert!(set_shortcuts(&c, &id, &vec![Shortcut::App { id: "a".into() }; MAX_SHORTCUTS + 1]).is_err());
        assert!(set_shortcuts(&c, "missing", &[]).is_err());
    }

    #[test]
    fn shortcut_json_shape_matches_the_frontend() {
        let v = serde_json::to_value(Shortcut::App { id: "x".into() }).unwrap();
        assert_eq!(v["kind"], "app");
        let back: Shortcut = serde_json::from_str("{\"kind\":\"folder\",\"path\":\"C:\\\\a\"}").unwrap();
        assert_eq!(back, Shortcut::Folder { path: "C:\\a".into(), label: None });
    }

    #[test]
    fn reorder_sets_positions() {
        let c = conn();
        let a = list(&c).unwrap()[0].id.clone();
        let b = create(&c, "B", "grid", &[]).unwrap().id;
        reorder(&c, &[b.clone(), a.clone()]).unwrap();
        assert_eq!(list(&c).unwrap()[0].id, b);
    }
}
