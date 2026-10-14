import { useState } from "react";
import type { Shop } from "../types";
import { PickMenu } from "./PickMenu";
import { CATALOGUE, SLOTS, itemById, type DecorItem } from "./shop";
import type { SceneName } from "./scenes";

// An empty spot is outlined at the size of a typical decoration.
const EMPTY = { width: 48, height: 42 };
// Spook floats under the sign, at the middle of the 960-wide stage.
const SPOOK_X = 480;

interface Props {
  scene: SceneName;
  shop: Shop;
  place: (id: string, slot: string | null) => Promise<void>;
  onError: (e: unknown) => void;
}

/** Decorate mode: every spot in this scene gets an outline; clicking one picks what stands there. */
export function DecorateSpots({ scene, shop, place, onError }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const owned = CATALOGUE.filter((i): i is DecorItem => i.kind !== "hat" && shop.owned.includes(i.id));
  const slotOf = (id: string) => SLOTS.find((s) => shop.placements[s.id] === id);

  return SLOTS.filter((s) => s.scene === scene).map((slot) => {
    const holderId = shop.placements[slot.id];
    const holder = holderId ? itemById(holderId) : undefined;
    const size = holder && holder.kind !== "hat" ? holder : EMPTY;
    const width = size.width * slot.scale;
    const height = size.height * slot.scale;
    const box = { left: slot.x - width / 2, top: slot.y - height, width, height };

    const items = owned
      .filter((item) => item.kind === slot.kind)
      .map((item) => {
        const here = item.id === holderId;
        const elsewhere = here ? undefined : slotOf(item.id);
        return {
          key: item.id,
          label: item.name,
          hint: here ? "here now" : elsewhere ? `move from ${elsewhere.label}` : undefined,
          checked: here,
          disabled: here,
          onPick: () => place(item.id, slot.id).catch(onError),
        };
      });
    if (holderId) items.push({ key: "empty", label: "Empty this spot", hint: undefined, checked: false, disabled: false, onPick: () => place(holderId, null).catch(onError) });

    return (
      <div key={slot.id}>
        <button
          type="button"
          className={holder ? "spot filled" : "spot"}
          style={box}
          data-pick-trigger
          aria-haspopup="menu"
          aria-expanded={open === slot.id}
          aria-label={`${slot.label}: ${holder ? holder.name : "empty"}`}
          onClick={() => setOpen(open === slot.id ? null : slot.id)}
        >
          {!holder && "+"}
        </button>
        {open === slot.id && (
          <PickMenu
            label={slot.label}
            items={items}
            // Normally above the spot (below is the bottom band and the buttons), growing away from
            // Spook so it never covers him. `.pick-menu`'s max-width keeps it inside a narrow window.
            style={
              slot.menuBelow
                ? // Grows leftwards, into the room: rightwards it would run off a window under 960 px.
                  { left: box.left + width, top: slot.y + 6, transform: "translateX(-100%)" }
                : slot.x < SPOOK_X
                ? { left: box.left + width, top: box.top - 6, transform: "translate(-100%, -100%)" }
                : { left: box.left, top: box.top - 6, transform: "translateY(-100%)" }
            }
            onClose={() => setOpen(null)}
          />
        )}
      </div>
    );
  });
}
