import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Shop } from "./types";
import { useWindowVisible } from "./useWindowVisible";

/** Beans that just came in; `n` changes every time, so the "+N" animation replays. */
export interface Earned {
  amount: number;
  n: number;
}

/**
 * The shop's state, shared by the scene (hat, decorations, balance button) and the shop dialog.
 * Earning happens in Rust (a block completes, a to-do is ticked), which emits `shop` with the new
 * state and `beans-earned` with the amount; buying and placing answer with the new state directly.
 */
export function useShop() {
  const [shop, setShop] = useState<Shop | null>(null);
  const [earned, setEarned] = useState<Earned | null>(null);
  const visible = useWindowVisible();

  // Also on showing the window: "to-do beans left today" resets at midnight without an event.
  useEffect(() => {
    if (visible) invoke<Shop>("get_shop").then(setShop);
  }, [visible]);

  useEffect(() => {
    const unlistenShop = listen<Shop>("shop", (e) => setShop(e.payload));
    const unlistenEarned = listen<number>("beans-earned", (e) =>
      setEarned((prev) => ({ amount: e.payload, n: (prev?.n ?? 0) + 1 })),
    );
    return () => {
      unlistenShop.then((stop) => stop());
      unlistenEarned.then((stop) => stop());
    };
  }, []);

  // Rejections carry the Rust error message, for the dialog to show.
  const run = useCallback(
    (cmd: string, args: Record<string, unknown>) => invoke<Shop>(cmd, args).then(setShop),
    [],
  );

  return {
    shop,
    earned,
    buy: (id: string) => run("buy_item", { id }),
    wear: (id: string | null) => run("wear_hat", { id }),
    place: (id: string, slot: string | null) => run("place_item", { id, slot }),
  };
}

export type ShopState = ReturnType<typeof useShop>;
