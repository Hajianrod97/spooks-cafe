import { useEffect, useRef } from "react";

/**
 * Opens a `<dialog>` as a modal on mount: focus trapping, Esc to close and a backdrop come
 * free. The `open` guard is for StrictMode, which runs effects twice in dev.
 */
export function useModal() {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  return ref;
}
