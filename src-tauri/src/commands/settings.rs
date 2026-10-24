use std::collections::HashMap;

use tauri::State;

use crate::db::Database;
use crate::error::AppError;
use crate::state::now_ms;

const MAX_KEY_LEN: usize = 128;
const MAX_VALUE_LEN: usize = 64 * 1024;

#[tauri::command]
pub fn settings_get_all(db: State<'_, Database>) -> Result<HashMap<String, String>, AppError> {
    db.with(|conn| {
        let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
        let rows = stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))?;
        let mut map = HashMap::new();
        for row in rows {
            let (key, value) = row?;
            map.insert(key, value);
        }
        Ok(map)
    })
}

#[tauri::command]
pub fn settings_set(db: State<'_, Database>, key: String, value: String) -> Result<(), AppError> {
    if key.is_empty() || key.len() > MAX_KEY_LEN {
        return Err(AppError::Invalid("settings key must be 1–128 characters".into()));
    }
    if value.len() > MAX_VALUE_LEN {
        return Err(AppError::Invalid("settings value is too large".into()));
    }
    db.with(|conn| {
        conn.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            rusqlite::params![key, value, now_ms() as i64],
        )?;
        Ok(())
    })
}

#[tauri::command]
pub fn settings_delete(db: State<'_, Database>, key: String) -> Result<(), AppError> {
    db.with(|conn| {
        conn.execute("DELETE FROM settings WHERE key = ?1", rusqlite::params![key])?;
        Ok(())
    })
}
