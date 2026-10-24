# NOIR — Architecture & Visual Direction

## 1. Visual direction: the NOIR Interface System (NIS)

NOIR looks like instrumentation, not a game launcher. Hierarchy comes from **type, contrast and space**, never from color.

**Signature elements (original to NOIR)**
- **Index system.** Every section carries a two-digit index (`01 — OVERVIEW`). Indexes appear in the sidebar, page headers and shortcuts (`Ctrl 1…8`), so the app reads like a numbered system.
- **Micro labels.** Tiny, tracked, uppercase JetBrains Mono (`.nis-label`) for metadata; Inter for everything you read; mono for every number that changes.
- **One-stroke mark.** The logo is a single continuous "N" stroke.
- **Hairline cards.** 1 px `#303030` borders, a 3 %-white inner top highlight, no glow. Hover raises border contrast only.
- **Monochrome data viz.** Series are separated by tone *and* stroke pattern (solid / dashed / dotted) with hatched area fills — never by hue.
- **White close button.** Even the window close button inverts to white instead of red.

**Tokens** (`tailwind.config.js`): `noir-black #080808` · `obsidian #111` · `charcoal #191919` · `graphite #242424` · `line #303030` · `ash #5c5c5c` · `silver #888` · `mist #b5b5b5` · `paper #f2f2f2` · `white #fff`. Radii 14 (cards) / 10 (controls).

**Motion rules** (`src/lib/motion.ts`): one easing curve `cubic-bezier(.22,1,.36,1)`; durations 120 / 180 / 240 ms; critically-damped spring for layout (no bounce); opacity + transform only; reduced motion honored from the OS or Settings (`data-motion="reduce"` + `MotionConfig`).

## 2. System architecture

```
┌────────────────────────── WebView2 (React + TS) ──────────────────────────┐
│  pages / features  →  components/ui (NIS)  →  Tailwind tokens             │
│        │                                                                  │
│  zustand stores:  nav · prefs (persisted) · monitor (1 Hz poll)           │
│        │                                                                  │
│  lib/tauri.ts  ── typed invoke() wrapper, isTauri() guard                 │
└────────┼──────────────────────────────────────────────────────────────────┘
         │ IPC (commands, camelCase JSON)
┌────────▼──────────────────────── Rust (Tauri 2) ──────────────────────────┐
│  commands/settings.rs   settings_get_all / settings_set / settings_delete │
│  commands/system.rs     get_system_info / get_snapshot / get_storage /    │
│                         get_session_info / get_app_info                   │
│  state.rs   MonitorState (long-lived sysinfo::System), SessionState       │
│  db.rs      SQLite (rusqlite, WAL) + versioned migrations                 │
│  error.rs   AppError → serializes to a plain string for the UI            │
└───────────────────────────────────────────────────────────────────────────┘
```

**Principles**
- **Real data only.** Every number on screen comes from a Rust command. If the runtime can't supply it, the widget says so; unbuilt features show a labelled empty state with their phase.
- **Frontend/backend separation.** The UI never touches the OS; it calls typed commands. Rust owns files, system access and the database.
- **Performance.** One polling loop (paused while the window is hidden, no overlapping calls); a 60-sample ring buffer; selectors return primitives so only changed widgets render; numbers tween by writing to the DOM (no re-render); charts are plain SVG.
- **Security.** Tauri capabilities grant only window controls; strict CSP; no network access; settings keys/values are validated in Rust; SQLite access is parameterized.
- **Migrations.** Append-only list in `db.rs`, tracked with `PRAGMA user_version`.

## 3. Project layout

```
noir/
├─ src/
│  ├─ App.tsx, main.tsx
│  ├─ styles/index.css            base styles, .nis-* utilities, reduced motion
│  ├─ lib/                        cn, motion, tauri, types, format, nav, settings, window
│  ├─ hooks/                      useElementWidth, useNow, global shortcuts
│  ├─ store/                      nav, prefs (SQLite-backed), monitor (live data)
│  ├─ components/
│  │  ├─ ui/                      Button Card Tooltip Toggle Tabs Modal Input/SearchField
│  │  │                           Skeleton EmptyState Menu(Dropdown/ContextMenu) Chart
│  │  │                           AnimatedNumber Toast Logo
│  │  └─ shell/                   TitleBar, Sidebar, PageHeader
│  ├─ features/home/              Dashboard, WidgetFrame, layout model, registry, widgets/
│  └─ pages/                      SettingsPage, PlannedPage
└─ src-tauri/
   ├─ src/                        lib.rs, db.rs, state.rs, error.rs, commands/
   ├─ capabilities/default.json
   └─ tauri.conf.json             frameless window, CSP, NSIS target
```

## 4. Roadmap status

| Phase | Scope | Status |
|---|---|---|
| 1 | Architecture, dependencies, structure, design system | Done |
| 2 | Shell, window controls, navigation, Home dashboard, Settings | Done |
| 3 | Pulse (GPU, temperatures, processes, disk throughput), Orbit (installed-app discovery, launching) | Done |
| 4 | Spaces, Command, Vault, Flow | Done |
| 5 | Per-Space layouts and shortcuts, customization, permissioned automations | Done |
| 6 | Tests, verification, installer | Done, except code signing |

**Verification status.** Frontend: type-checked and production-built; every screen exercised in a browser against fixture data. Rust: the Tauri-independent modules compile and pass their unit tests on Linux. **Not yet verified on a real Windows machine:** the Tauri wiring and the `#[cfg(windows)]` code (Start-menu discovery via `Get-StartApps`, GPU via `nvidia-smi` / performance counters, Explorer launching). Treat the first `npm run tauri dev` run as the integration test.

**Known limits.** Temperatures appear only if Windows exposes sensors without administrator rights, otherwise Pulse says so. GPU load uses Windows performance counters (any vendor) or `nvidia-smi`. Widgets are reordered and resized with buttons and a context menu, not drag-and-drop. The installer is unsigned.
