use serde::{Serialize, Serializer};

/// Single error type for everything that crosses the IPC boundary.
/// It serializes to a plain string so the frontend can display it directly.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),

    #[error("file system error: {0}")]
    Io(#[from] std::io::Error),

    #[error("internal state is unavailable (lock poisoned)")]
    Lock,

    #[error("{0}")]
    Invalid(String),
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}
