//! While the timer runs, opts out of App Nap. Without this, macOS throttles a windowless menu bar
//! app, and the delayed ticks look like sleep to the ticker, which pauses the timer.

use tauri::AppHandle;

/// Safe to call from any thread, as often as you like: the work is queued onto the main thread,
/// where the activity token lives, and only a change in `busy` does anything.
pub fn set_busy(app: &AppHandle, busy: bool) {
    #[cfg(target_os = "macos")]
    let _ = app.run_on_main_thread(move || macos::set_busy(busy));
    #[cfg(not(target_os = "macos"))]
    let _ = (app, busy);
}

#[cfg(target_os = "macos")]
mod macos {
    use std::cell::RefCell;

    use objc2::rc::Retained;
    use objc2::runtime::{NSObjectProtocol, ProtocolObject};
    use objc2_foundation::{NSActivityOptions, NSProcessInfo, NSString};

    type Token = Retained<ProtocolObject<dyn NSObjectProtocol>>;

    thread_local! {
        static ACTIVITY: RefCell<Option<Token>> = const { RefCell::new(None) };
    }

    pub fn set_busy(busy: bool) {
        ACTIVITY.with_borrow_mut(|activity| {
            let info = NSProcessInfo::processInfo();
            match (busy, activity.take()) {
                (true, None) => {
                    let reason = NSString::from_str("Pomodoro timer running");
                    // Idle system sleep is still allowed; the ticker handles real sleep.
                    let options = NSActivityOptions::UserInitiatedAllowingIdleSystemSleep;
                    *activity = Some(info.beginActivityWithOptions_reason(options, &reason));
                }
                (false, Some(token)) => unsafe { info.endActivity(&token) },
                (_, unchanged) => *activity = unchanged,
            }
        });
    }
}
