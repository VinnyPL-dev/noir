use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, MutexGuard};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use sysinfo::{Networks, System};

use crate::error::AppError;

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Loopback traffic never leaves the machine and would count every byte as
/// both sent and received, so it is excluded from throughput.
fn is_loopback(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower == "lo" || lower.starts_with("loopback")
}

pub fn network_totals() -> (u64, u64) {
    let networks = Networks::new_with_refreshed_list();
    networks
        .iter()
        .filter(|(name, _)| !is_loopback(name))
        .fold((0u64, 0u64), |(rx, tx), (_, data)| {
            (rx + data.total_received(), tx + data.total_transmitted())
        })
}

pub struct MonitorInner {
    pub sys: System,
    pub last_rx: u64,
    pub last_tx: u64,
    pub last_at: Instant,
}

/// Long-lived sampler. sysinfo needs two CPU refreshes some time apart to
/// produce a meaningful usage value, so the `System` must persist between calls.
pub struct MonitorState {
    inner: Mutex<MonitorInner>,
}

impl MonitorState {
    pub fn new() -> Self {
        let mut sys = System::new();
        sys.refresh_cpu_usage();
        sys.refresh_memory();
        let (rx, tx) = network_totals();
        Self {
            inner: Mutex::new(MonitorInner {
                sys,
                last_rx: rx,
                last_tx: tx,
                last_at: Instant::now(),
            }),
        }
    }

    pub fn lock(&self) -> Result<MutexGuard<'_, MonitorInner>, AppError> {
        self.inner.lock().map_err(|_| AppError::Lock)
    }
}

/// Information about the current NOIR session (this launch of the app).
pub struct SessionState {
    pub started_at_ms: u64,
}

impl SessionState {
    pub fn new() -> Self {
        Self {
            started_at_ms: now_ms(),
        }
    }
}

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Short unique id such as `note_19a3f0c12b40`. Unique per launch by counter,
/// across launches by the millisecond clock.
pub fn new_id(prefix: &str) -> String {
    let n = ID_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{prefix}_{:x}{:02x}", now_ms(), n % 256)
}
