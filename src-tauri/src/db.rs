use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::Connection;

use crate::error::AppError;

/// Ordered, append-only schema migrations. The index + 1 is stored in
/// `PRAGMA user_version`, so each migration runs exactly once.
/// Never edit a shipped migration — add a new one at the end instead.
const MIGRATIONS: &[&str] = &[
    // v1 — key/value settings (preferences, dashboard layout, …)
    "CREATE TABLE settings (
        key        TEXT PRIMARY KEY NOT NULL,
        value      TEXT NOT NULL,
        updated_at INTEGER NOT NULL
    );",
    // v2 — Orbit: discovered and custom applications, with usage tracking
    "CREATE TABLE apps (
        id              TEXT PRIMARY KEY NOT NULL,
        name            TEXT NOT NULL,
        kind            TEXT NOT NULL,
        target          TEXT NOT NULL,
        category        TEXT NOT NULL DEFAULT 'Other',
        category_locked INTEGER NOT NULL DEFAULT 0,
        icon            TEXT,
        favorite        INTEGER NOT NULL DEFAULT 0,
        hidden          INTEGER NOT NULL DEFAULT 0,
        launch_count    INTEGER NOT NULL DEFAULT 0,
        last_launched   INTEGER,
        present         INTEGER NOT NULL DEFAULT 1,
        added_at        INTEGER NOT NULL
    );
    CREATE INDEX idx_apps_last_launched ON apps(last_launched);",
    // v3 — Flow: notes, projects, tasks, focus sessions
    "CREATE TABLE notes (
        id         TEXT PRIMARY KEY NOT NULL,
        title      TEXT NOT NULL DEFAULT '',
        body       TEXT NOT NULL DEFAULT '',
        pinned     INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );
    CREATE TABLE projects (
        id          TEXT PRIMARY KEY NOT NULL,
        name        TEXT NOT NULL,
        path        TEXT,
        archived    INTEGER NOT NULL DEFAULT 0,
        created_at  INTEGER NOT NULL,
        last_opened INTEGER
    );
    CREATE TABLE tasks (
        id           TEXT PRIMARY KEY NOT NULL,
        title        TEXT NOT NULL,
        done         INTEGER NOT NULL DEFAULT 0,
        pinned       INTEGER NOT NULL DEFAULT 0,
        due          INTEGER,
        project_id   TEXT REFERENCES projects(id) ON DELETE SET NULL,
        created_at   INTEGER NOT NULL,
        completed_at INTEGER
    );
    CREATE TABLE work_sessions (
        id            TEXT PRIMARY KEY NOT NULL,
        label         TEXT NOT NULL DEFAULT '',
        project_id    TEXT REFERENCES projects(id) ON DELETE SET NULL,
        started_at    INTEGER NOT NULL,
        duration_secs INTEGER NOT NULL,
        kind          TEXT NOT NULL
    );
    CREATE INDEX idx_tasks_project ON tasks(project_id);
    CREATE INDEX idx_sessions_started ON work_sessions(started_at);",
    // v4 — Vault: favorite folders, recent files, collections
    "CREATE TABLE vault_folders (
        path     TEXT PRIMARY KEY NOT NULL,
        label    TEXT NOT NULL,
        added_at INTEGER NOT NULL
    );
    CREATE TABLE vault_recent (
        path      TEXT PRIMARY KEY NOT NULL,
        opened_at INTEGER NOT NULL
    );
    CREATE TABLE vault_collections (
        id         TEXT PRIMARY KEY NOT NULL,
        name       TEXT NOT NULL,
        created_at INTEGER NOT NULL
    );
    CREATE TABLE vault_collection_items (
        collection_id TEXT NOT NULL REFERENCES vault_collections(id) ON DELETE CASCADE,
        path          TEXT NOT NULL,
        added_at      INTEGER NOT NULL,
        PRIMARY KEY (collection_id, path)
    );",
    // v5 — Spaces and Automations
    "CREATE TABLE spaces (
        id         TEXT PRIMARY KEY NOT NULL,
        name       TEXT NOT NULL,
        icon       TEXT NOT NULL DEFAULT 'grid',
        position   INTEGER NOT NULL,
        layout     TEXT,
        prefs      TEXT NOT NULL DEFAULT '{}',
        shortcuts  TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL
    );
    CREATE TABLE automations (
        id         TEXT PRIMARY KEY NOT NULL,
        name       TEXT NOT NULL,
        space_id   TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
        actions    TEXT NOT NULL DEFAULT '[]',
        enabled    INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        last_run   INTEGER
    );
    CREATE TABLE automation_log (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        automation_id TEXT NOT NULL,
        name          TEXT NOT NULL,
        ran_at        INTEGER NOT NULL,
        ok            INTEGER NOT NULL,
        detail        TEXT NOT NULL
    );",
];

pub struct Database {
    conn: Mutex<Connection>,
    path: PathBuf,
}

impl Database {
    pub fn open(path: PathBuf) -> Result<Self, AppError> {
        let conn = Connection::open(&path)?;
        // execute_batch tolerates PRAGMAs that return a row (journal_mode does).
        conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")?;
        migrate(&conn)?;
        Ok(Self {
            conn: Mutex::new(conn),
            path,
        })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn with<T>(&self, f: impl FnOnce(&Connection) -> Result<T, AppError>) -> Result<T, AppError> {
        let guard = self.conn.lock().map_err(|_| AppError::Lock)?;
        f(&guard)
    }
}

pub fn migrate(conn: &Connection) -> Result<(), AppError> {
    let current: usize = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    for (index, sql) in MIGRATIONS.iter().enumerate().skip(current) {
        conn.execute_batch(&format!(
            "BEGIN; {sql} PRAGMA user_version = {}; COMMIT;",
            index + 1
        ))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_are_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        migrate(&conn).unwrap();
        let version: usize = conn
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(version, MIGRATIONS.len());
    }
}
