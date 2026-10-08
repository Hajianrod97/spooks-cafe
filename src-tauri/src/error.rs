use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Db(#[from] rusqlite::Error),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Tauri(#[from] tauri::Error),
    #[error(transparent)]
    Autostart(#[from] tauri_plugin_autostart::Error),
    /// The requested action doesn't apply to the timer's current phase.
    #[error("{0}")]
    InvalidState(&'static str),
    /// A value sent from the UI failed validation.
    #[error("{0}")]
    InvalidInput(&'static str),
}

// Commands return errors to the frontend, so they must be serializable; send the message.
impl Serialize for Error {
    fn serialize<S: Serializer>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, Error>;
