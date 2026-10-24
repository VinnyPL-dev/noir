//! FLOW — notes, tasks, projects and focus sessions. Local SQLite only.

use rusqlite::{params, Connection, Row};
use serde::Serialize;

use crate::error::AppError;
use crate::state::{new_id, now_ms};

const MAX_TITLE: usize = 200;
const MAX_NOTE_BODY: usize = 200_000;

fn clean(label: &str, value: &str, max: usize) -> Result<String, AppError> {
    let v = value.trim();
    if v.is_empty() {
        return Err(AppError::Invalid(format!("{label} can't be empty.")));
    }
    if v.chars().count() > max {
        return Err(AppError::Invalid(format!("{label} is too long (max {max} characters).")));
    }
    Ok(v.to_string())
}

fn changed(n: usize) -> Result<(), AppError> {
    if n == 0 {
        Err(AppError::Invalid("That item no longer exists.".into()))
    } else {
        Ok(())
    }
}

fn ts() -> i64 {
    now_ms() as i64
}

// ───────────────────────────── notes ─────────────────────────────

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub title: String,
    pub body: String,
    pub pinned: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

fn note_row(r: &Row) -> rusqlite::Result<Note> {
    Ok(Note {
        id: r.get(0)?,
        title: r.get(1)?,
        body: r.get(2)?,
        pinned: r.get::<_, i64>(3)? != 0,
        created_at: r.get(4)?,
        updated_at: r.get(5)?,
    })
}

const NOTE_COLS: &str = "id, title, body, pinned, created_at, updated_at";

fn like_pattern(query: &str) -> String {
    let escaped = query.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_");
    format!("%{escaped}%")
}

pub fn note_list(conn: &Connection, query: Option<&str>) -> Result<Vec<Note>, AppError> {
    let pattern = query.map(str::trim).filter(|q| !q.is_empty()).map(like_pattern);
    let mut stmt = conn.prepare(&format!(
        "SELECT {NOTE_COLS} FROM notes
         WHERE (?1 IS NULL OR title LIKE ?1 ESCAPE '\\' OR body LIKE ?1 ESCAPE '\\')
         ORDER BY pinned DESC, updated_at DESC"
    ))?;
    let rows = stmt.query_map(params![pattern], note_row)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn note_create(conn: &Connection, title: &str, body: &str) -> Result<Note, AppError> {
    let title = title.trim();
    if title.chars().count() > MAX_TITLE || body.len() > MAX_NOTE_BODY {
        return Err(AppError::Invalid("That note is too large.".into()));
    }
    let id = new_id("note");
    let now = ts();
    conn.execute(
        "INSERT INTO notes (id, title, body, pinned, created_at, updated_at) VALUES (?1, ?2, ?3, 0, ?4, ?4)",
        params![id, title, body, now],
    )?;
    Ok(conn.query_row(&format!("SELECT {NOTE_COLS} FROM notes WHERE id = ?1"), params![id], note_row)?)
}

/// Autosave target: returns the new `updated_at`.
pub fn note_update(conn: &Connection, id: &str, title: &str, body: &str) -> Result<i64, AppError> {
    let title = title.trim();
    if title.chars().count() > MAX_TITLE {
        return Err(AppError::Invalid(format!("Title is too long (max {MAX_TITLE} characters).")));
    }
    if body.len() > MAX_NOTE_BODY {
        return Err(AppError::Invalid("That note is too large (200 KB maximum).".into()));
    }
    let now = ts();
    changed(conn.execute(
        "UPDATE notes SET title = ?2, body = ?3, updated_at = ?4 WHERE id = ?1",
        params![id, title, body, now],
    )?)?;
    Ok(now)
}

pub fn note_set_pinned(conn: &Connection, id: &str, pinned: bool) -> Result<(), AppError> {
    changed(conn.execute("UPDATE notes SET pinned = ?2 WHERE id = ?1", params![id, pinned as i64])?)
}

pub fn note_delete(conn: &Connection, id: &str) -> Result<(), AppError> {
    changed(conn.execute("DELETE FROM notes WHERE id = ?1", params![id])?)
}

// ───────────────────────────── projects ─────────────────────────────

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: Option<String>,
    pub archived: bool,
    pub created_at: i64,
    pub last_opened: Option<i64>,
    pub open_tasks: i64,
    pub focus_secs: i64,
}

const PROJECT_SQL: &str = "SELECT p.id, p.name, p.path, p.archived, p.created_at, p.last_opened,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.done = 0),
        (SELECT COALESCE(SUM(duration_secs), 0) FROM work_sessions s WHERE s.project_id = p.id)
     FROM projects p";

fn project_row(r: &Row) -> rusqlite::Result<Project> {
    Ok(Project {
        id: r.get(0)?,
        name: r.get(1)?,
        path: r.get(2)?,
        archived: r.get::<_, i64>(3)? != 0,
        created_at: r.get(4)?,
        last_opened: r.get(5)?,
        open_tasks: r.get(6)?,
        focus_secs: r.get(7)?,
    })
}

pub fn project_list(conn: &Connection) -> Result<Vec<Project>, AppError> {
    let mut stmt = conn.prepare(&format!(
        "{PROJECT_SQL} ORDER BY p.archived, COALESCE(p.last_opened, p.created_at) DESC"
    ))?;
    let rows = stmt.query_map([], project_row)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

fn project_get(conn: &Connection, id: &str) -> Result<Project, AppError> {
    Ok(conn.query_row(&format!("{PROJECT_SQL} WHERE p.id = ?1"), params![id], project_row)?)
}

pub fn project_add(conn: &Connection, name: &str, path: Option<&str>) -> Result<Project, AppError> {
    let name = clean("Project name", name, 80)?;
    let id = new_id("proj");
    conn.execute(
        "INSERT INTO projects (id, name, path, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![id, name, path, ts()],
    )?;
    project_get(conn, &id)
}

pub fn project_update(conn: &Connection, id: &str, name: &str, path: Option<&str>) -> Result<Project, AppError> {
    let name = clean("Project name", name, 80)?;
    changed(conn.execute(
        "UPDATE projects SET name = ?2, path = ?3 WHERE id = ?1",
        params![id, name, path],
    )?)?;
    project_get(conn, id)
}

pub fn project_set_archived(conn: &Connection, id: &str, archived: bool) -> Result<(), AppError> {
    changed(conn.execute("UPDATE projects SET archived = ?2 WHERE id = ?1", params![id, archived as i64])?)
}

/// Tasks and sessions keep existing but lose the link (ON DELETE SET NULL).
pub fn project_delete(conn: &Connection, id: &str) -> Result<(), AppError> {
    changed(conn.execute("DELETE FROM projects WHERE id = ?1", params![id])?)
}

pub fn project_touch(conn: &Connection, id: &str) -> Result<(), AppError> {
    changed(conn.execute("UPDATE projects SET last_opened = ?2 WHERE id = ?1", params![id, ts()])?)
}

pub fn project_path(conn: &Connection, id: &str) -> Result<Option<String>, AppError> {
    match conn.query_row("SELECT path FROM projects WHERE id = ?1", params![id], |r| r.get::<_, Option<String>>(0)) {
        Ok(p) => Ok(p),
        Err(rusqlite::Error::QueryReturnedNoRows) => Err(AppError::Invalid("That project no longer exists.".into())),
        Err(e) => Err(e.into()),
    }
}

// ───────────────────────────── tasks ─────────────────────────────

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub title: String,
    pub done: bool,
    pub pinned: bool,
    pub due: Option<i64>,
    pub project_id: Option<String>,
    pub created_at: i64,
    pub completed_at: Option<i64>,
}

const TASK_COLS: &str = "id, title, done, pinned, due, project_id, created_at, completed_at";

fn task_row(r: &Row) -> rusqlite::Result<Task> {
    Ok(Task {
        id: r.get(0)?,
        title: r.get(1)?,
        done: r.get::<_, i64>(2)? != 0,
        pinned: r.get::<_, i64>(3)? != 0,
        due: r.get(4)?,
        project_id: r.get(5)?,
        created_at: r.get(6)?,
        completed_at: r.get(7)?,
    })
}

fn project_exists(conn: &Connection, id: Option<&str>) -> Result<(), AppError> {
    if let Some(id) = id {
        let n: i64 = conn.query_row("SELECT COUNT(*) FROM projects WHERE id = ?1", params![id], |r| r.get(0))?;
        if n == 0 {
            return Err(AppError::Invalid("That project no longer exists.".into()));
        }
    }
    Ok(())
}

pub fn task_list(conn: &Connection) -> Result<Vec<Task>, AppError> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {TASK_COLS} FROM tasks
         ORDER BY done ASC, pinned DESC, (due IS NULL), due ASC, created_at DESC"
    ))?;
    let rows = stmt.query_map([], task_row)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn task_add(conn: &Connection, title: &str, project_id: Option<&str>, due: Option<i64>) -> Result<Task, AppError> {
    let title = clean("Task", title, MAX_TITLE)?;
    project_exists(conn, project_id)?;
    let id = new_id("task");
    conn.execute(
        "INSERT INTO tasks (id, title, project_id, due, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, title, project_id, due, ts()],
    )?;
    Ok(conn.query_row(&format!("SELECT {TASK_COLS} FROM tasks WHERE id = ?1"), params![id], task_row)?)
}

pub fn task_update(conn: &Connection, id: &str, title: &str, project_id: Option<&str>, due: Option<i64>) -> Result<(), AppError> {
    let title = clean("Task", title, MAX_TITLE)?;
    project_exists(conn, project_id)?;
    changed(conn.execute(
        "UPDATE tasks SET title = ?2, project_id = ?3, due = ?4 WHERE id = ?1",
        params![id, title, project_id, due],
    )?)
}

pub fn task_set_done(conn: &Connection, id: &str, done: bool) -> Result<(), AppError> {
    let completed = if done { Some(ts()) } else { None };
    changed(conn.execute(
        "UPDATE tasks SET done = ?2, completed_at = ?3 WHERE id = ?1",
        params![id, done as i64, completed],
    )?)
}

pub fn task_set_pinned(conn: &Connection, id: &str, pinned: bool) -> Result<(), AppError> {
    changed(conn.execute("UPDATE tasks SET pinned = ?2 WHERE id = ?1", params![id, pinned as i64])?)
}

pub fn task_delete(conn: &Connection, id: &str) -> Result<(), AppError> {
    changed(conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])?)
}

pub fn task_clear_done(conn: &Connection) -> Result<usize, AppError> {
    Ok(conn.execute("DELETE FROM tasks WHERE done = 1", [])?)
}

// ───────────────────────────── focus sessions ─────────────────────────────

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkSession {
    pub id: String,
    pub label: String,
    pub project_id: Option<String>,
    pub started_at: i64,
    pub duration_secs: i64,
    pub kind: String,
}

fn session_row(r: &Row) -> rusqlite::Result<WorkSession> {
    Ok(WorkSession {
        id: r.get(0)?,
        label: r.get(1)?,
        project_id: r.get(2)?,
        started_at: r.get(3)?,
        duration_secs: r.get(4)?,
        kind: r.get(5)?,
    })
}

pub fn session_add(
    conn: &Connection,
    label: &str,
    project_id: Option<&str>,
    started_at: i64,
    duration_secs: i64,
    kind: &str,
) -> Result<WorkSession, AppError> {
    if !["stopwatch", "countdown"].contains(&kind) {
        return Err(AppError::Invalid("Unknown timer type.".into()));
    }
    if !(1..=48 * 3600).contains(&duration_secs) {
        return Err(AppError::Invalid("A session must last between 1 second and 48 hours.".into()));
    }
    let label = label.trim();
    if label.chars().count() > 120 {
        return Err(AppError::Invalid("That label is too long.".into()));
    }
    project_exists(conn, project_id)?;
    let id = new_id("sess");
    conn.execute(
        "INSERT INTO work_sessions (id, label, project_id, started_at, duration_secs, kind) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, label, project_id, started_at, duration_secs, kind],
    )?;
    Ok(conn.query_row(
        "SELECT id, label, project_id, started_at, duration_secs, kind FROM work_sessions WHERE id = ?1",
        params![id],
        session_row,
    )?)
}

pub fn session_list(conn: &Connection, limit: i64) -> Result<Vec<WorkSession>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, label, project_id, started_at, duration_secs, kind FROM work_sessions
         ORDER BY started_at DESC LIMIT ?1",
    )?;
    let rows = stmt.query_map(params![limit.clamp(1, 500)], session_row)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn session_delete(conn: &Connection, id: &str) -> Result<(), AppError> {
    changed(conn.execute("DELETE FROM work_sessions WHERE id = ?1", params![id])?)
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
    fn notes_save_search_and_pin() {
        let c = conn();
        let a = note_create(&c, "Shopping", "milk and 100% juice").unwrap();
        let b = note_create(&c, "Ideas", "build a launcher").unwrap();
        note_update(&c, &b.id, "Ideas v2", "build a launcher with spaces").unwrap();
        assert_eq!(note_list(&c, Some("juice")).unwrap().len(), 1);
        assert_eq!(note_list(&c, Some("100%")).unwrap().len(), 1, "% is literal, not a wildcard");
        assert_eq!(note_list(&c, Some("%")).unwrap().len(), 1);
        assert_eq!(note_list(&c, Some("_")).unwrap().len(), 0, "_ is literal");
        assert_eq!(note_list(&c, Some("   ")).unwrap().len(), 2);
        note_set_pinned(&c, &a.id, true).unwrap();
        assert_eq!(note_list(&c, None).unwrap()[0].id, a.id, "pinned first");
        note_delete(&c, &a.id).unwrap();
        assert!(note_delete(&c, &a.id).is_err());
        assert!(note_update(&c, "missing", "t", "b").is_err());
    }

    #[test]
    fn note_size_limit() {
        let c = conn();
        let n = note_create(&c, "x", "").unwrap();
        assert!(note_update(&c, &n.id, "x", &"a".repeat(MAX_NOTE_BODY + 1)).is_err());
    }

    #[test]
    fn tasks_projects_and_ordering() {
        let c = conn();
        let p = project_add(&c, "  Website  ", Some("C:\\dev\\site")).unwrap();
        assert_eq!(p.name, "Website");
        assert!(project_add(&c, "   ", None).is_err());
        let t1 = task_add(&c, "later", Some(&p.id), Some(2_000)).unwrap();
        let t2 = task_add(&c, "sooner", None, Some(1_000)).unwrap();
        let t3 = task_add(&c, "no date", None, None).unwrap();
        let order: Vec<_> = task_list(&c).unwrap().into_iter().map(|t| t.id).collect();
        assert_eq!(order, vec![t2.id.clone(), t1.id.clone(), t3.id.clone()]);
        assert!(task_add(&c, "x", Some("nope"), None).is_err());
        assert!(task_add(&c, "  ", None, None).is_err());
        task_set_done(&c, &t2.id, true).unwrap();
        assert_eq!(task_list(&c).unwrap().last().unwrap().id, t2.id, "done tasks sink");
        assert_eq!(project_list(&c).unwrap()[0].open_tasks, 1);
        task_set_pinned(&c, &t3.id, true).unwrap();
        assert_eq!(task_list(&c).unwrap()[0].id, t3.id, "pinned first");
        assert_eq!(task_clear_done(&c).unwrap(), 1);
        project_delete(&c, &p.id).unwrap();
        let orphan = task_list(&c).unwrap().into_iter().find(|t| t.id == t1.id).unwrap();
        assert!(orphan.project_id.is_none(), "deleting a project keeps its tasks");
    }

    #[test]
    fn sessions_validate_and_count_toward_projects() {
        let c = conn();
        let p = project_add(&c, "Game", None).unwrap();
        session_add(&c, "deep work", Some(&p.id), 1, 1500, "countdown").unwrap();
        session_add(&c, "", Some(&p.id), 2, 300, "stopwatch").unwrap();
        assert!(session_add(&c, "x", None, 3, 0, "stopwatch").is_err());
        assert!(session_add(&c, "x", None, 3, 10, "pomodoro").is_err());
        assert!(session_add(&c, "x", None, 3, 49 * 3600, "stopwatch").is_err());
        assert_eq!(project_list(&c).unwrap()[0].focus_secs, 1800);
        let list = session_list(&c, 10).unwrap();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].started_at, 2, "newest first");
        session_delete(&c, &list[0].id).unwrap();
    }

    #[test]
    fn project_path_lookup() {
        let c = conn();
        let p = project_add(&c, "A", Some("C:\\a")).unwrap();
        assert_eq!(project_path(&c, &p.id).unwrap().as_deref(), Some("C:\\a"));
        assert!(project_path(&c, "missing").is_err());
        project_touch(&c, &p.id).unwrap();
        assert!(project_list(&c).unwrap()[0].last_opened.is_some());
    }
}
