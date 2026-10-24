use serde::Serialize;
use sysinfo::{DiskKind, Disks, System};
use tauri::{AppHandle, Manager, State};

use crate::db::Database;
use crate::error::AppError;
use crate::state::{network_totals, now_ms, MonitorState, SessionState};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    hostname: String,
    os_name: String,
    os_version: String,
    cpu_brand: String,
    physical_cores: Option<usize>,
    logical_cores: usize,
    total_memory: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    timestamp_ms: u64,
    cpu_usage: f32,
    per_core: Vec<f32>,
    memory_used: u64,
    memory_total: u64,
    rx_per_sec: f64,
    tx_per_sec: f64,
    uptime_secs: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskInfo {
    name: String,
    mount_point: String,
    file_system: String,
    kind: &'static str,
    total: u64,
    available: u64,
    removable: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    username: String,
    started_at_ms: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    version: String,
    data_dir: String,
    db_path: String,
}

/// Static facts about this machine. Called once at startup.
#[tauri::command]
pub fn get_system_info(monitor: State<'_, MonitorState>) -> Result<SystemInfo, AppError> {
    let guard = monitor.lock()?;
    let cpu_brand = guard
        .sys
        .cpus()
        .first()
        .map(|cpu| cpu.brand().trim().to_string())
        .unwrap_or_default();

    Ok(SystemInfo {
        hostname: System::host_name().unwrap_or_default(),
        os_name: System::name().unwrap_or_else(|| "Windows".into()),
        os_version: System::long_os_version().unwrap_or_default(),
        cpu_brand,
        physical_cores: guard.sys.physical_core_count(),
        logical_cores: guard.sys.cpus().len(),
        total_memory: guard.sys.total_memory(),
    })
}

/// One real reading of CPU, memory and network throughput.
/// Polled by the frontend (about once per second, paused while hidden).
#[tauri::command]
pub fn get_snapshot(monitor: State<'_, MonitorState>) -> Result<Snapshot, AppError> {
    let mut guard = monitor.lock()?;
    guard.sys.refresh_cpu_usage();
    guard.sys.refresh_memory();

    let (rx, tx) = network_totals();
    let elapsed = guard.last_at.elapsed().as_secs_f64().max(0.001);
    let rx_per_sec = rx.saturating_sub(guard.last_rx) as f64 / elapsed;
    let tx_per_sec = tx.saturating_sub(guard.last_tx) as f64 / elapsed;
    guard.last_rx = rx;
    guard.last_tx = tx;
    guard.last_at = std::time::Instant::now();

    Ok(Snapshot {
        timestamp_ms: now_ms(),
        cpu_usage: guard.sys.global_cpu_usage(),
        per_core: guard.sys.cpus().iter().map(|c| c.cpu_usage()).collect(),
        memory_used: guard.sys.used_memory(),
        memory_total: guard.sys.total_memory(),
        rx_per_sec,
        tx_per_sec,
        uptime_secs: System::uptime(),
    })
}

/// Mounted volumes with real capacity numbers. Polled rarely (storage changes slowly).
#[tauri::command]
pub fn get_storage() -> Result<Vec<DiskInfo>, AppError> {
    let disks = Disks::new_with_refreshed_list();
    let mut list: Vec<DiskInfo> = disks
        .iter()
        .filter(|d| d.total_space() > 0)
        .map(|d| DiskInfo {
            name: d.name().to_string_lossy().to_string(),
            mount_point: d.mount_point().to_string_lossy().to_string(),
            file_system: d.file_system().to_string_lossy().to_string(),
            kind: match d.kind() {
                DiskKind::SSD => "SSD",
                DiskKind::HDD => "HDD",
                _ => "Unknown",
            },
            total: d.total_space(),
            available: d.available_space(),
            removable: d.is_removable(),
        })
        .collect();
    list.sort_by(|a, b| a.mount_point.cmp(&b.mount_point));
    Ok(list)
}

#[tauri::command]
pub fn get_session_info(session: State<'_, SessionState>) -> SessionInfo {
    let username = std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_default();
    SessionInfo {
        username,
        started_at_ms: session.started_at_ms,
    }
}

#[tauri::command]
pub fn get_app_info(app: AppHandle, db: State<'_, Database>) -> Result<AppInfo, AppError> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    Ok(AppInfo {
        version: app.package_info().version.to_string(),
        data_dir,
        db_path: db.path().to_string_lossy().to_string(),
    })
}
