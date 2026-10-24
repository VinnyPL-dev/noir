//! COMMAND — the global shortcut that summons NOIR and opens the palette.
//!
//! The shortcut is registered from Rust so it works while NOIR is in the
//! background. Pressing it raises the main window and emits `noir:command`;
//! the UI then opens the palette.

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use crate::db::Database;
use crate::error::AppError;
use crate::state::now_ms;

pub const DEFAULT_SHORTCUT: &str = "Ctrl+Shift+Space";
const SETTING_KEY: &str = "command.shortcut";

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutInfo {
    pub accelerator: String,
    pub registered: bool,
    pub error: Option<String>,
}

pub struct CommandShortcut(pub Mutex<ShortcutInfo>);

fn summon<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
    let _ = app.emit("noir:command", ());
}

/// The plugin, with the handler that reacts to the registered shortcut.
pub fn plugin<R: Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                summon(app);
            }
        })
        .build()
}

/// Replaces whatever shortcut is registered with `accelerator`.
pub fn apply<R: Runtime>(app: &AppHandle<R>, accelerator: &str) -> ShortcutInfo {
    let shortcuts = app.global_shortcut();
    let _ = shortcuts.unregister_all();
    let outcome = accelerator
        .parse::<Shortcut>()
        .map_err(|e| format!("“{accelerator}” isn't a valid shortcut ({e})."))
        .and_then(|shortcut| {
            shortcuts
                .register(shortcut)
                .map_err(|_| format!("{accelerator} is already used by another app or by Windows."))
        });
    match outcome {
        Ok(()) => ShortcutInfo { accelerator: accelerator.to_string(), registered: true, error: None },
        Err(error) => ShortcutInfo { accelerator: accelerator.to_string(), registered: false, error: Some(error) },
    }
}

/// Called once from `setup`: registers the saved (or default) shortcut.
pub fn init<R: Runtime>(app: &AppHandle<R>) {
    let saved = app
        .state::<Database>()
        .with(|c| {
            Ok(c.query_row("SELECT value FROM settings WHERE key = ?1", rusqlite::params![SETTING_KEY], |r| r.get::<_, String>(0))
                .ok())
        })
        .ok()
        .flatten();
    let info = apply(app, saved.as_deref().unwrap_or(DEFAULT_SHORTCUT));
    app.manage(CommandShortcut(Mutex::new(info)));
}

#[tauri::command]
pub fn command_shortcut_get(state: State<'_, CommandShortcut>) -> Result<ShortcutInfo, AppError> {
    Ok(state.0.lock().map_err(|_| AppError::Lock)?.clone())
}

#[tauri::command]
pub fn command_shortcut_set(
    app: AppHandle,
    db: State<'_, Database>,
    state: State<'_, CommandShortcut>,
    accelerator: String,
) -> Result<ShortcutInfo, AppError> {
    let accelerator = accelerator.trim().to_string();
    if accelerator.is_empty() || accelerator.len() > 64 {
        return Err(AppError::Invalid("Choose a shortcut.".into()));
    }
    let previous = state.0.lock().map_err(|_| AppError::Lock)?.accelerator.clone();
    let info = apply(&app, &accelerator);
    if !info.registered {
        let _ = apply(&app, &previous); // put the old one back
        return Err(AppError::Invalid(info.error.unwrap_or_else(|| "That shortcut can't be used.".into())));
    }
    db.with(|c| {
        c.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            rusqlite::params![SETTING_KEY, accelerator, now_ms() as i64],
        )?;
        Ok(())
    })?;
    *state.0.lock().map_err(|_| AppError::Lock)? = info.clone();
    Ok(info)
}
