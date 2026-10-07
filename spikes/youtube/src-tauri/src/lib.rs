use serde::Deserialize;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const PLAYER_LABEL: &str = "yt-player";
const SIGNIN_LABEL: &str = "signin";

// Google rejects sign-in from user agents that look like an embedded webview.
// WKWebView's default UA omits the "Version/x Safari/x" tokens, so we claim to be Safari.
const SAFARI_UA: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) \
    AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum PlayerAction {
    Play,
    Pause,
    Toggle,
    SetVolume { level: u8 },
}

fn action_js(action: &PlayerAction) -> String {
    let body = match action {
        PlayerAction::Play => "v.play();".to_string(),
        PlayerAction::Pause => "v.pause();".to_string(),
        PlayerAction::Toggle => "v.paused ? v.play() : v.pause();".to_string(),
        PlayerAction::SetVolume { level } => {
            format!("v.volume = {};", (*level).min(100) as f32 / 100.0)
        }
    };
    // The <video> may not exist yet while the page loads; skip quietly rather than throw.
    format!("(() => {{ const v = document.querySelector('video'); if (v) {{ {body} }} }})();")
}

fn parse_url(url: &str) -> Result<WebviewUrl, String> {
    url.parse().map(WebviewUrl::External).map_err(|e| format!("bad url: {e}"))
}

#[tauri::command]
fn open_signin(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(SIGNIN_LABEL) {
        return w.set_focus().map_err(|e| e.to_string());
    }
    let url = parse_url(
        "https://accounts.google.com/ServiceLogin?service=youtube&continue=https://www.youtube.com/",
    )?;
    WebviewWindowBuilder::new(&app, SIGNIN_LABEL, url)
        .title("Sign in to YouTube")
        .user_agent(SAFARI_UA)
        .inner_size(500.0, 700.0)
        .build()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn open_player(app: AppHandle, url: String) -> Result<(), String> {
    let target = parse_url(&url)?;
    if let Some(w) = app.get_webview_window(PLAYER_LABEL) {
        let WebviewUrl::External(u) = target else { unreachable!() };
        w.navigate(u).map_err(|e| e.to_string())?;
        return w.show().map_err(|e| e.to_string());
    }
    WebviewWindowBuilder::new(&app, PLAYER_LABEL, target)
        .title("YouTube Player")
        .user_agent(SAFARI_UA)
        .inner_size(640.0, 400.0)
        .build()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_player_visible(app: AppHandle, visible: bool) -> Result<(), String> {
    let w = app
        .get_webview_window(PLAYER_LABEL)
        .ok_or("player not open")?;
    if visible { w.show() } else { w.hide() }.map_err(|e| e.to_string())
}

#[tauri::command]
fn player_control(app: AppHandle, action: PlayerAction) -> Result<(), String> {
    let w = app
        .get_webview_window(PLAYER_LABEL)
        .ok_or("player not open")?;
    w.eval(action_js(&action)).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            open_signin,
            open_player,
            set_player_visible,
            player_control
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
