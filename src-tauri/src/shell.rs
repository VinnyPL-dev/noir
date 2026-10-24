//! Safe, minimal bridges to Windows Explorer and the default browser.
//!
//! Everything here is user-initiated, validated, and never goes through a
//! command shell: arguments are passed directly to `explorer.exe`.

use std::fs;
use std::path::{Path, PathBuf};

use crate::error::AppError;

/// Programs and scripts are never started from the file browser or from
/// automations through the "open file" path. They must be added to Orbit.
const BLOCKED_EXTENSIONS: &[&str] = &[
    "exe", "bat", "cmd", "com", "msi", "msp", "scr", "ps1", "psm1", "vbs", "vbe", "js", "jse", "wsf", "wsh",
    "hta", "cpl", "reg", "lnk", "jar", "dll", "sys", "appx", "msix", "pif", "gadget",
];

/// Strips the `\\?\` prefix that `canonicalize` adds on Windows (but not for UNC paths).
pub fn plain(path: PathBuf) -> PathBuf {
    let text = path.to_string_lossy().to_string();
    if let Some(rest) = text.strip_prefix(r"\\?\") {
        if !rest.starts_with("UNC\\") {
            return PathBuf::from(rest);
        }
    }
    path
}

/// Absolute, existing path (file or folder), with `..` and links resolved.
pub fn existing_path(raw: &str) -> Result<PathBuf, AppError> {
    let trimmed = raw.trim().trim_matches('"');
    if trimmed.is_empty() || trimmed.len() > 4096 || trimmed.contains('\0') {
        return Err(AppError::Invalid("Choose a valid path.".into()));
    }
    let path = PathBuf::from(trimmed);
    if !path.is_absolute() {
        return Err(AppError::Invalid("Use a full path (for example C:\\Users\\you\\Documents).".into()));
    }
    fs::canonicalize(&path)
        .map(plain)
        .map_err(|_| AppError::Invalid("That path doesn't exist or can't be accessed.".into()))
}

pub fn existing_dir(raw: &str) -> Result<PathBuf, AppError> {
    let path = existing_path(raw)?;
    if path.is_dir() {
        Ok(path)
    } else {
        Err(AppError::Invalid("That path is not a folder.".into()))
    }
}

pub fn is_blocked_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| BLOCKED_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

/// Only plain web links. No `file:`, `javascript:`, custom protocols, or spaces.
pub fn validate_url(raw: &str) -> Result<String, AppError> {
    let url = raw.trim();
    let lower = url.to_ascii_lowercase();
    let ok_scheme = lower.starts_with("https://") || lower.starts_with("http://");
    let host_part = lower.split("://").nth(1).unwrap_or("");
    if !ok_scheme
        || url.len() > 2048
        || host_part.is_empty()
        || url.chars().any(|c| c.is_whitespace() || c.is_control() || c == '"')
    {
        return Err(AppError::Invalid("Enter a web address starting with http:// or https://".into()));
    }
    Ok(url.to_string())
}

#[cfg(windows)]
fn explorer() -> std::process::Command {
    std::process::Command::new("explorer.exe")
}

#[cfg(windows)]
pub fn open_folder(path: &Path) -> Result<(), AppError> {
    explorer().arg(path).spawn()?;
    Ok(())
}

#[cfg(windows)]
pub fn reveal(path: &Path) -> Result<(), AppError> {
    use std::os::windows::process::CommandExt;
    // Explorer parses /select, itself, so the argument must be passed raw.
    explorer()
        .raw_arg(format!("/select,\"{}\"", path.display()))
        .spawn()?;
    Ok(())
}

#[cfg(windows)]
pub fn open_file(path: &Path) -> Result<(), AppError> {
    if is_blocked_extension(path) {
        return Err(AppError::Invalid(
            "NOIR won't run programs from the file browser. Add it to Orbit, or reveal it in Explorer.".into(),
        ));
    }
    explorer().arg(path).spawn()?;
    Ok(())
}

#[cfg(windows)]
pub fn open_url(url: &str) -> Result<(), AppError> {
    let url = validate_url(url)?;
    explorer().arg(url).spawn()?;
    Ok(())
}

#[cfg(not(windows))]
pub fn open_folder(_path: &Path) -> Result<(), AppError> {
    Err(AppError::Invalid("Opening folders is only available on Windows.".into()))
}
#[cfg(not(windows))]
pub fn reveal(_path: &Path) -> Result<(), AppError> {
    Err(AppError::Invalid("Revealing files is only available on Windows.".into()))
}
#[cfg(not(windows))]
pub fn open_file(path: &Path) -> Result<(), AppError> {
    if is_blocked_extension(path) {
        return Err(AppError::Invalid("NOIR won't run programs from the file browser.".into()));
    }
    Err(AppError::Invalid("Opening files is only available on Windows.".into()))
}
#[cfg(not(windows))]
pub fn open_url(url: &str) -> Result<(), AppError> {
    validate_url(url)?;
    Err(AppError::Invalid("Opening links is only available on Windows.".into()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn urls_are_restricted_to_web_links() {
        assert!(validate_url("https://example.com/a?b=1&c=2").is_ok());
        assert!(validate_url("http://localhost:3000").is_ok());
        for bad in ["file:///C:/Windows/System32/cmd.exe", "javascript:alert(1)", "ms-settings:", "https://", "https://a b.com", "calc.exe", ""] {
            assert!(validate_url(bad).is_err(), "{bad} should be rejected");
        }
    }

    #[test]
    fn programs_are_blocked_from_open_file() {
        assert!(is_blocked_extension(Path::new("C:/x/setup.EXE")));
        assert!(is_blocked_extension(Path::new("a.ps1")));
        assert!(!is_blocked_extension(Path::new("notes.txt")));
        assert!(!is_blocked_extension(Path::new("noext")));
    }

    #[test]
    fn plain_strips_verbatim_prefix_but_not_unc() {
        assert_eq!(plain(PathBuf::from(r"\\?\C:\Users\a")), PathBuf::from(r"C:\Users\a"));
        assert_eq!(plain(PathBuf::from(r"\\?\UNC\srv\share")), PathBuf::from(r"\\?\UNC\srv\share"));
    }

    #[test]
    fn relative_and_missing_paths_are_rejected() {
        assert!(existing_path("relative/path").is_err());
        assert!(existing_path("").is_err());
        assert!(existing_path("/definitely/not/here/xyz").is_err());
    }
}
