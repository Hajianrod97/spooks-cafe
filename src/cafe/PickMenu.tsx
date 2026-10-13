import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";

export interface PickItem {
  key: string;
  label: string;
  hint?: string;
  /** Set for choices where one is current (a radio group); shows a ✓. */
  checked?: boolean;
  disabled?: boolean;
  onPick: () => void;
}

interface Props {
  label: string;
  items: PickItem[];
  /** Stage coordinates; the menu sits in the scene overlay. */
  style: CSSProperties;
  onClose: () => void;
}

/**
 * A small menu over the scene (Spook's hats, a decoration spot). Focus moves into it on open and
 * back to where it was on close; arrows move, Esc or a click outside closes. The button that opens
 * it carries `data-pick-trigger`, so pressing it again toggles rather than closing and reopening.
 */
export function PickMenu({ label, items, style, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // Kept in a ref so a new `onClose` each render doesn't rerun the effect (and refocus).
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const away = (e: PointerEvent) => {
      const target = e.target as Element;
      if (!ref.current?.contains(target) && !target.closest("[data-pick-trigger]")) close.current();
    };
    document.addEventListener("pointerdown", away);
    return () => {
      document.removeEventListener("pointerdown", away);
      // Only if focus would otherwise be lost, not when the click moved it somewhere on purpose.
      if (!document.activeElement || document.activeElement === document.body || ref.current?.contains(document.activeElement)) {
        returnTo?.focus();
      }
    };
  }, []);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      // Handled here, so an Esc that closes the menu doesn't also leave Decorate mode.
      e.stopPropagation();
      return close.current();
    }
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(i + step + buttons.length) % buttons.length]?.focus();
  }

  return (
    <div ref={ref} className="pick-menu" role="menu" aria-label={label} style={style} onKeyDown={onKeyDown}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role={item.checked === undefined ? "menuitem" : "menuitemradio"}
          aria-checked={item.checked}
          disabled={item.disabled}
          onClick={() => {
            item.onPick();
            close.current();
          }}
        >
          <span className="pick-check" aria-hidden="true">{item.checked ? "✓" : ""}</span>
          <span>
            {item.label}
            {item.hint && <span className="pick-hint">{item.hint}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
