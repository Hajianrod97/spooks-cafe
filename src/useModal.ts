import { useEffect, useRef } from "react";

/**
 * Opens a `<dialog>` as a modal on mount: focus trapping, Esc to close and a backdrop come
 * free. The `open` guard is for StrictMode, which runs effects twice in dev.
 *
 * Dialogs close by unmounting, not through `dialog.close()`, so the browser's own "focus goes
 * back to the opener" isn't guaranteed (Chrome does it on removal; WebKit's behaviour has
 * varied). On unmount, focus returns to whatever had it before, unless it already went somewhere.
 */
export function useModal() {
  const ref = useRef<HTMLDialogElement>(null);
  // Set only by the run that opens it: StrictMode's second run would find focus inside the dialog.
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (ref.current && !ref.current.open) {
      opener.current = document.activeElement as HTMLElement | null;
      ref.current.showModal();
    }
    return () => {
      const now = document.activeElement;
      if (!now || now === document.body || !now.isConnected) opener.current?.focus();
    };
  }, []);
  return ref;
}
