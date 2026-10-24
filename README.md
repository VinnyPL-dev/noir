# NOIR

A premium, monochrome command center for Windows 10/11. Built with Tauri 2, React, TypeScript, Tailwind, Rust and SQLite.

**Status: Phases 1–6 implemented** — design system, shell, customizable Home, Pulse (real CPU/RAM/GPU/disk/network/processes; temperatures when Windows exposes them), Orbit (installed-app discovery and launcher), Vault (file workspace), Flow (notes, tasks, timers, projects), Command (global palette), Spaces and permissioned Automations. See `docs/ARCHITECTURE.md`.

## Prerequisites (Windows)

1. **Node.js 20+** — https://nodejs.org
2. **Rust (stable, MSVC toolchain)** — https://rustup.rs
3. **Microsoft C++ Build Tools** ("Desktop development with C++" workload)
4. **WebView2 Runtime** — preinstalled on Windows 11 and current Windows 10

## Run it

```powershell
npm install
npm run tauri dev
```

The first run compiles the Rust dependencies (several minutes); later runs are fast.

## Build the installer

```powershell
npm run tauri build
```

Produces an NSIS installer under `src-tauri/target/release/bundle/nsis/`. The installer is unsigned, so Windows SmartScreen / Smart App Control may warn about it. Code signing needs a certificate and is not set up.

## Publish a downloadable installer (no build tools needed by users)

1. Create a GitHub repository and push this project to it.
2. Push a version tag: `git tag v0.1.0` then `git push --tags` (or run the **Release** workflow from the Actions tab).
3. GitHub builds the Windows installer and adds `NOIR_0.1.0_x64-setup.exe` to a **draft release**. Open Releases, review it and click **Publish**.
4. Share the release link. Users download the `.exe` and run it.

Users need nothing else installed; the installer fetches WebView2 if a PC lacks it. The installer is unsigned, so Windows SmartScreen shows a warning (More info, then Run anyway), and PCs with Smart App Control on will block it. Removing that needs a code-signing certificate.

## Useful commands

| Command | What it does |
|---|---|
| `npm run tauri dev` | Desktop app with hot reload |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Type-check + production frontend build |
| `npm run dev` | UI only in a browser tab (no native data; widgets show an honest "runtime not detected" state) |
| `cargo test` (in `src-tauri/`) | Rust tests (database, apps, hardware parsing, Vault, Flow, Spaces, Automations, shell safety) |

## Keyboard

`Ctrl B` toggle sidebar · `Ctrl 1…7` jump to a section · `Ctrl ,` Settings · `Ctrl K` command palette (in app) · global palette shortcut is configurable under Command (default `Ctrl+Space`) · `Alt 1…9` switch Space

## Where your data lives

A single SQLite file, `noir.db`, in `%APPDATA%\app.noir.desktop\`. Settings → About shows the exact path.

## Regenerating icons

Edit `app-icon.png` (1024×1024) and run `npx tauri icon app-icon.png`.
