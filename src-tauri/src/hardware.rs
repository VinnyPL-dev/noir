//! Real hardware readings that sysinfo does not provide on Windows:
//! GPU load (NVIDIA via `nvidia-smi`, any vendor via Windows performance
//! counters), temperature sensors, per-process usage and disk throughput.
//!
//! Nothing here invents data. When a reading is not available the result says
//! so (`None`, an empty list, or `status: "unavailable"` with a reason).
//!
//! This module has no dependency on Tauri so it can be unit-tested anywhere.

use std::collections::HashMap;
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::Serialize;
use sysinfo::{Components, ProcessRefreshKind, ProcessesToUpdate, System};

use crate::state::now_ms;

// ───────────────────────────── helpers ─────────────────────────────

/// Run a command without flashing a console window on Windows.
fn run_hidden(program: &str, args: &[&str]) -> Option<String> {
    let mut cmd = Command::new(program);
    cmd.args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    let output = cmd.output().ok()?;
    if !output.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&output.stdout).into_owned())
}

// ───────────────────────────── GPU ─────────────────────────────

#[derive(Serialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GpuReading {
    pub name: String,
    /// Load, 0–100.
    pub usage: Option<f32>,
    pub memory_used: Option<u64>,
    pub memory_total: Option<u64>,
    pub temperature: Option<f32>,
    pub power_watts: Option<f32>,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GpuSnapshot {
    /// "pending" (first sample not ready), "ok", or "unavailable".
    pub status: &'static str,
    /// Where the numbers come from, or why there are none.
    pub source: String,
    pub gpus: Vec<GpuReading>,
}

impl GpuSnapshot {
    fn pending() -> Self {
        Self {
            status: "pending",
            source: String::new(),
            gpus: vec![],
        }
    }
    fn unavailable(reason: &str) -> Self {
        Self {
            status: "unavailable",
            source: reason.to_string(),
            gpus: vec![],
        }
    }
}

fn parse_opt_f32(s: &str) -> Option<f32> {
    s.trim().parse::<f32>().ok().filter(|v| v.is_finite())
}

/// Parses `nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw
/// --format=csv,noheader,nounits`. Fields reported as `[N/A]` become `None`.
pub fn parse_nvidia_smi(out: &str) -> Vec<GpuReading> {
    const MIB: u64 = 1024 * 1024;
    out.lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split(',').map(str::trim).collect();
            if parts.len() < 6 || parts[0].is_empty() {
                return None;
            }
            Some(GpuReading {
                name: parts[0].to_string(),
                usage: parse_opt_f32(parts[1]).map(|v| v.clamp(0.0, 100.0)),
                memory_used: parse_opt_f32(parts[2]).map(|v| v as u64 * MIB),
                memory_total: parse_opt_f32(parts[3]).map(|v| v as u64 * MIB),
                temperature: parse_opt_f32(parts[4]),
                power_watts: parse_opt_f32(parts[5]),
            })
        })
        .collect()
}

/// Splits `typeperf` CSV output into (header cells, value cells) for the first sample.
fn typeperf_rows(out: &str) -> Option<(Vec<String>, Vec<String>)> {
    let mut rows = out.lines().map(str::trim).filter(|l| l.starts_with('"'));
    let header = rows.next()?;
    let values = rows.next()?;
    let split = |line: &str| -> Vec<String> {
        line.trim_matches('"').split("\",\"").map(|s| s.to_string()).collect()
    };
    Some((split(header), split(values)))
}

/// Parses `typeperf "\PhysicalDisk(_Total)\Disk Read Bytes/sec" "\PhysicalDisk(_Total)\Disk Write Bytes/sec" -sc 1`
/// into (read, write) bytes per second.
pub fn parse_typeperf_disk(out: &str) -> Option<(f64, f64)> {
    let (_, vals) = typeperf_rows(out)?;
    let read = vals.get(1)?.trim().parse::<f64>().ok()?;
    let write = vals.get(2)?.trim().parse::<f64>().ok()?;
    (read.is_finite() && write.is_finite()).then_some((read.max(0.0), write.max(0.0)))
}

/// Parses one `typeperf "\GPU Engine(*)\Utilization Percentage" -sc 1` run.
/// Engines of one adapter are summed per engine type; the busiest engine type
/// of the busiest adapter is the load (this mirrors Task Manager).
pub fn parse_typeperf_gpu(out: &str) -> Option<f32> {
    let (names, vals) = typeperf_rows(out)?;

    let mut sums: HashMap<String, f64> = HashMap::new();
    for (name, val) in names.iter().zip(vals.iter()).skip(1) {
        let lower = name.to_ascii_lowercase();
        let Some(luid_at) = lower.find("luid_") else { continue };
        let Some(eng_at) = lower.find("engtype_") else { continue };
        let luid_part = &lower[luid_at..];
        let luid = luid_part.split('_').take(3).collect::<Vec<_>>().join("_");
        let engtype = lower[eng_at..].split(')').next().unwrap_or("").to_string();
        let Ok(v) = val.trim().parse::<f64>() else { continue };
        *sums.entry(format!("{luid}|{engtype}")).or_insert(0.0) += v;
    }
    sums.values()
        .cloned()
        .fold(None, |acc: Option<f64>, v| Some(acc.map_or(v, |a| a.max(v))))
        .map(|v| v.clamp(0.0, 100.0) as f32)
}

fn video_controller_names() -> Vec<String> {
    let Some(out) = run_hidden(
        "powershell.exe",
        &[
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name }",
        ],
    ) else {
        return vec![];
    };
    out.lines()
        .map(|l| l.trim().trim_start_matches('\u{feff}').to_string())
        .filter(|l| {
            let lower = l.to_ascii_lowercase();
            !l.is_empty() && !lower.contains("basic display") && !lower.contains("remote")
        })
        .collect()
}

fn sample_gpu(cached_names: &mut Option<Vec<String>>) -> GpuSnapshot {
    if let Some(out) = run_hidden(
        "nvidia-smi",
        &[
            "--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw",
            "--format=csv,noheader,nounits",
        ],
    ) {
        let gpus = parse_nvidia_smi(&out);
        if !gpus.is_empty() {
            return GpuSnapshot {
                status: "ok",
                source: "NVIDIA driver (nvidia-smi)".into(),
                gpus,
            };
        }
    }

    if !cfg!(windows) {
        return GpuSnapshot::unavailable("GPU readings are only available on Windows.");
    }

    let load = run_hidden("typeperf", &["\\GPU Engine(*)\\Utilization Percentage", "-sc", "1"])
        .as_deref()
        .and_then(parse_typeperf_gpu);

    match load {
        Some(usage) => {
            let names = cached_names.get_or_insert_with(video_controller_names);
            GpuSnapshot {
                status: "ok",
                source: "Windows GPU performance counters".into(),
                gpus: vec![GpuReading {
                    name: if names.is_empty() { "Graphics adapter".into() } else { names.join(" / ") },
                    usage: Some(usage),
                    ..Default::default()
                }],
            }
        }
        None => GpuSnapshot::unavailable(
            "Windows exposed no GPU performance counters (needs Windows 10 1709 or later and a WDDM 2.0+ driver).",
        ),
    }
}

struct SensorShared {
    gpu: Mutex<GpuSnapshot>,
    disk_io: Mutex<Option<(f64, f64)>>,
    last_request_ms: AtomicU64,
}

/// Samples the GPU and disk throughput on a background thread (both are read
/// through external tools that take a second or so), but only while someone is
/// asking — a request in the last 8 seconds — so an idle app costs nothing.
#[derive(Clone)]
pub struct SensorState(Arc<SensorShared>);

impl SensorState {
    pub fn start() -> Self {
        let shared = Arc::new(SensorShared {
            gpu: Mutex::new(GpuSnapshot::pending()),
            disk_io: Mutex::new(None),
            last_request_ms: AtomicU64::new(0),
        });
        let worker = shared.clone();
        let _ = std::thread::Builder::new().name("noir-sensors".into()).spawn(move || {
            let mut names: Option<Vec<String>> = None;
            loop {
                std::thread::sleep(Duration::from_millis(1000));
                let last = worker.last_request_ms.load(Ordering::Relaxed);
                if now_ms().saturating_sub(last) > 8_000 {
                    continue;
                }
                let gpu = sample_gpu(&mut names);
                if let Ok(mut guard) = worker.gpu.lock() {
                    *guard = gpu;
                }
                let io = run_hidden(
                    "typeperf",
                    &[
                        "\\PhysicalDisk(_Total)\\Disk Read Bytes/sec",
                        "\\PhysicalDisk(_Total)\\Disk Write Bytes/sec",
                        "-sc",
                        "1",
                    ],
                )
                .as_deref()
                .and_then(parse_typeperf_disk);
                if let Ok(mut guard) = worker.disk_io.lock() {
                    *guard = io;
                }
            }
        });
        Self(shared)
    }

    fn touch(&self) {
        self.0.last_request_ms.store(now_ms(), Ordering::Relaxed);
    }

    /// Latest GPU reading; also tells the sampler somebody is watching.
    pub fn gpu(&self) -> GpuSnapshot {
        self.touch();
        self.0
            .gpu
            .lock()
            .map(|g| g.clone())
            .unwrap_or_else(|_| GpuSnapshot::unavailable("Sensor sampler stopped unexpectedly."))
    }

    /// (read, write) bytes per second across all physical disks, if Windows reports them.
    pub fn disk_io(&self) -> Option<(f64, f64)> {
        self.touch();
        self.0.disk_io.lock().ok().and_then(|g| *g)
    }
}

// ───────────────────────── temperatures ─────────────────────────

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TempReading {
    pub label: String,
    pub celsius: f32,
    pub max: Option<f32>,
    pub critical: Option<f32>,
}

/// Sensors the operating system actually exposes. On many Windows PCs this is
/// empty without elevated access — the UI says so instead of showing guesses.
pub fn temperatures() -> Vec<TempReading> {
    let components = Components::new_with_refreshed_list();
    let mut out: Vec<TempReading> = components
        .iter()
        .filter_map(|c| {
            let t = c.temperature();
            if !t.is_finite() || t <= 0.0 || t > 150.0 {
                return None;
            }
            let max = c.max();
            Some(TempReading {
                label: c.label().to_string(),
                celsius: t,
                max: (max.is_finite() && max > 0.0 && max < 200.0).then_some(max),
                critical: c.critical().filter(|v| v.is_finite() && *v > 0.0 && *v < 200.0),
            })
        })
        .collect();
    out.sort_by(|a, b| a.label.cmp(&b.label));
    out
}

// ───────────────────────── processes ─────────────────────────

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProcessGroup {
    pub name: String,
    pub count: usize,
    /// Share of total CPU capacity, 0–100 (like Task Manager).
    pub cpu: f32,
    pub memory: u64,
}

/// Groups processes by executable name (a browser with 30 processes is one row),
/// then keeps the heaviest by CPU and by memory.
pub fn group_processes(rows: &[(String, f32, u64)], logical_cores: usize, keep: usize) -> Vec<ProcessGroup> {
    let cores = logical_cores.max(1) as f32;
    let mut map: HashMap<String, ProcessGroup> = HashMap::new();
    for (name, cpu, mem) in rows {
        let key = name.to_ascii_lowercase();
        let entry = map.entry(key).or_insert_with(|| ProcessGroup {
            name: name.clone(),
            count: 0,
            cpu: 0.0,
            memory: 0,
        });
        entry.count += 1;
        entry.cpu += cpu / cores;
        entry.memory += mem;
    }
    let all: Vec<ProcessGroup> = map.into_values().collect();

    let mut by_cpu = all.clone();
    by_cpu.sort_by(|a, b| b.cpu.partial_cmp(&a.cpu).unwrap_or(std::cmp::Ordering::Equal));
    let mut by_mem = all;
    by_mem.sort_by(|a, b| b.memory.cmp(&a.memory));

    let mut picked: Vec<ProcessGroup> = Vec::new();
    for g in by_cpu.into_iter().take(keep).chain(by_mem.into_iter().take(keep)) {
        if !picked.iter().any(|p| p.name.eq_ignore_ascii_case(&g.name)) {
            picked.push(g);
        }
    }
    picked.sort_by(|a, b| {
        b.cpu
            .partial_cmp(&a.cpu)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(b.memory.cmp(&a.memory))
    });
    picked
}

// ───────────────────────── pulse state ─────────────────────────

/// Long-lived process sampler for the Pulse page. sysinfo needs two refreshes
/// some time apart to produce per-process CPU deltas.
pub struct PulseState {
    pub procs: Mutex<System>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProcessReport {
    pub groups: Vec<ProcessGroup>,
    pub process_count: usize,
}

impl PulseState {
    pub fn new() -> Self {
        let mut sys = System::new();
        sys.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::new().with_cpu().with_memory(),
        );
        sys.refresh_cpu_usage();
        Self {
            procs: Mutex::new(sys),
        }
    }

    pub fn processes(&self) -> Option<ProcessReport> {
        let mut sys = self.procs.lock().ok()?;
        sys.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::new().with_cpu().with_memory(),
        );
        if sys.cpus().is_empty() {
            sys.refresh_cpu_usage();
        }
        let rows: Vec<(String, f32, u64)> = sys
            .processes()
            .values()
            .map(|p| (p.name().to_string_lossy().to_string(), p.cpu_usage(), p.memory()))
            .collect();
        let cores = sys.cpus().len();
        Some(ProcessReport {
            process_count: rows.len(),
            groups: group_processes(&rows, cores, 40),
        })
    }
}

// ───────────────────────────── tests ─────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_nvidia_smi_rows() {
        let out = "NVIDIA GeForce RTX 3060, 12, 1021, 12288, 45, 28.51\nNVIDIA T400, [N/A], 100, 2048, 51, [N/A]\n";
        let gpus = parse_nvidia_smi(out);
        assert_eq!(gpus.len(), 2);
        assert_eq!(gpus[0].name, "NVIDIA GeForce RTX 3060");
        assert_eq!(gpus[0].usage, Some(12.0));
        assert_eq!(gpus[0].memory_total, Some(12288 * 1024 * 1024));
        assert_eq!(gpus[0].power_watts, Some(28.51));
        assert_eq!(gpus[1].usage, None);
        assert_eq!(gpus[1].power_watts, None);
    }

    #[test]
    fn nvidia_smi_ignores_garbage() {
        assert!(parse_nvidia_smi("NVIDIA-SMI has failed because it couldn't communicate").is_empty());
        assert!(parse_nvidia_smi("").is_empty());
    }

    #[test]
    fn parses_typeperf_and_takes_busiest_engine() {
        let out = "\n\"(PDH-CSV 4.0)\",\"\\\\PC\\GPU Engine(pid_10_luid_0x00000000_0x0000AAAA_phys_0_eng_0_engtype_3D)\\Utilization Percentage\",\"\\\\PC\\GPU Engine(pid_22_luid_0x00000000_0x0000AAAA_phys_0_eng_0_engtype_3D)\\Utilization Percentage\",\"\\\\PC\\GPU Engine(pid_22_luid_0x00000000_0x0000AAAA_phys_0_eng_1_engtype_VideoDecode)\\Utilization Percentage\"\n\"10/21/2026 23:00:00.123\",\"30.5\",\"20.25\",\"60.0\"\nExiting, after 1 samples.\n";
        // 3D: 30.5 + 20.25 = 50.75 ; VideoDecode: 60.0 → busiest engine type wins.
        let v = parse_typeperf_gpu(out).unwrap();
        assert!((v - 60.0).abs() < 0.01, "got {v}");
    }

    #[test]
    fn parses_typeperf_disk_throughput() {
        let out = "\"(PDH-CSV 4.0)\",\"\\\\PC\\PhysicalDisk(_Total)\\Disk Read Bytes/sec\",\"\\\\PC\\PhysicalDisk(_Total)\\Disk Write Bytes/sec\"\n\"10/21/2026 23:00:00.123\",\"1048576.5\",\"2048.0\"\n";
        assert_eq!(parse_typeperf_disk(out), Some((1048576.5, 2048.0)));
        assert_eq!(parse_typeperf_disk("Error: No valid counters."), None);
    }

    #[test]
    fn typeperf_without_counters_is_none() {
        assert_eq!(parse_typeperf_gpu("Error: No valid counters."), None);
    }

    #[test]
    fn groups_processes_by_name() {
        let rows = vec![
            ("chrome.exe".to_string(), 40.0, 300),
            ("Chrome.exe".to_string(), 20.0, 200),
            ("code.exe".to_string(), 10.0, 900),
        ];
        let g = group_processes(&rows, 4, 10);
        let chrome = g.iter().find(|p| p.name.eq_ignore_ascii_case("chrome.exe")).unwrap();
        assert_eq!(chrome.count, 2);
        assert!((chrome.cpu - 15.0).abs() < 0.01);
        assert_eq!(chrome.memory, 500);
        assert_eq!(g[0].name.to_ascii_lowercase(), "chrome.exe"); // highest CPU first
    }

    #[test]
    fn samplers_construct_and_report() {
        let state = PulseState::new();
        assert!(state.processes().is_some());
        let _ = temperatures(); // must not panic, may be empty
    }
}
