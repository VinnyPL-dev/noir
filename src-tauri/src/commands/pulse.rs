use serde::Serialize;
use tauri::State;

use crate::error::AppError;
use crate::hardware::{self, GpuSnapshot, ProcessGroup, ProcessReport, PulseState, SensorState, TempReading};
use crate::state::now_ms;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PulseSnapshot {
    timestamp_ms: u64,
    processes: Vec<ProcessGroup>,
    process_count: usize,
    /// None when Windows exposes no disk counters.
    disk_read_per_sec: Option<f64>,
    disk_write_per_sec: Option<f64>,
    temperatures: Vec<TempReading>,
    gpu: GpuSnapshot,
}

/// Everything the Pulse page needs beyond the 1 Hz snapshot. Polled about every
/// 2 seconds while Pulse is open. `async` runs it on the thread pool, not the UI thread.
#[tauri::command(async)]
pub fn get_pulse(
    include_processes: bool,
    pulse: State<'_, PulseState>,
    sensors: State<'_, SensorState>,
) -> Result<PulseSnapshot, AppError> {
    // The process scan is the expensive part; the Home widget only needs GPU data.
    let report = if include_processes {
        pulse.processes().ok_or(AppError::Lock)?
    } else {
        ProcessReport { groups: vec![], process_count: 0 }
    };
    let io = sensors.disk_io();
    Ok(PulseSnapshot {
        timestamp_ms: now_ms(),
        processes: report.groups,
        process_count: report.process_count,
        disk_read_per_sec: io.map(|v| v.0),
        disk_write_per_sec: io.map(|v| v.1),
        temperatures: hardware::temperatures(),
        gpu: sensors.gpu(),
    })
}
