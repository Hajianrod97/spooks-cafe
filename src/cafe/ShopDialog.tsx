import { useRef, useState, type KeyboardEvent, type SyntheticEvent } from "react";
import type { ShopState } from "../useShop";
import { useModal } from "../useModal";
import { BeanIcon } from "./BeanIcon";
import { CATALOGUE, SLOTS, hatArt, itemById, type DecorItem, type HatItem, type Item } from "./shop";
import { COUNTER_POSES } from "./Spook";

const TABS = [
  { id: "hats", label: "Hats" },
  { id: "decor", label: "Decor" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const HATS = CATALOGUE.filter((i): i is HatItem => i.kind === "hat");
const DECOR = CATALOGUE.filter((i): i is DecorItem => i.kind !== "hat");

interface Props {
  shop: ShopState;
  onClose: () => void;
}

/**
 * Buying only. Hats are changed by clicking Spook, and decorations placed in the scene's
 * Decorate mode, so you dress the cafe where you can see it.
 */
export function ShopDialog({ shop: { shop, buy }, onClose }: Props) {
  const dialog = useModal();
  const [tab, setTab] = useState<Tab>("hats");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  // The item whose Buy button is waiting for its second click.
  const [confirming, setConfirming] = useState<string | null>(null);
  // The hat on the try-on Spook; defaults to the one he's wearing.
  const [trying, setTrying] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState("");

  if (!shop) return null;
  const owns = (id: string) => shop.owned.includes(id);

  function onBuy(item: Item) {
    if (confirming !== item.id) return setConfirming(item.id);
    setConfirming(null);
    buy(item.id).then(() => {
      setError("");
      // A bought hat goes on by itself, so the try-on follows what he's wearing again.
      if (item.kind === "hat") setTrying(undefined);
    }, (e) => setError(String(e)));
  }

  // Esc backs out of a pending purchase before it closes the shop.
  function onCancel(e: SyntheticEvent) {
    if (confirming) {
      e.preventDefault();
      setConfirming(null);
    }
  }

  function onTabKey(e: KeyboardEvent) {
    const i = TABS.findIndex((t) => t.id === tab);
    const to = { ArrowRight: (i + 1) % TABS.length, ArrowLeft: (i + TABS.length - 1) % TABS.length, Home: 0, End: TABS.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    setTab(TABS[to].id);
    tabs.current[to]?.focus();
  }

  function buyButton(item: Item) {
    const short = shop!.balance < item.price;
    const asking = confirming === item.id;
    return (
      <button
        type="button"
        className={asking ? "shop-buy asking" : "shop-buy"}
        disabled={short}
        title={short ? `${item.price - shop!.balance} more beans to go` : undefined}
        onClick={() => onBuy(item)}
      >
        {asking ? "Confirm" : "Buy"} <BeanIcon size={16} /> {item.price}
        {asking && "?"}
      </button>
    );
  }

  const owned = <span className="shop-owned">Owned</span>;
  const shownHat = trying === undefined ? shop.hat : trying;
  const tryOnHat = shownHat ? hatArt(shownHat, "counter", "idle") : undefined;

  return (
    <dialog ref={dialog} className="editor shop" onClose={onClose} onCancel={onCancel}>
      <h2>Cafe shop</h2>
      <p className="shop-balance">
        <BeanIcon size={22} /> <strong>{shop.balance}</strong> beans
        <span className="hint"> · from focus blocks and to-dos</span>
      </p>

      <div className="shop-tabs" role="tablist" aria-label="Shop sections" onKeyDown={onTabKey}>
        {TABS.map(({ id, label }, i) => (
          <button
            key={id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            id={`shop-tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            aria-controls={`shop-panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div id={`shop-panel-${tab}`} role="tabpanel" aria-labelledby={`shop-tab-${tab}`}>
        {tab === "hats" && (
          <>
            <div
              className="shop-tryon"
              role="img"
              aria-label={shownHat ? `Spook trying on the ${itemById(shownHat)?.name.toLowerCase()}` : "Spook, no hat"}
            >
              <img src={COUNTER_POSES.idle.src} alt="" />
              {tryOnHat && <img src={tryOnHat} alt="" />}
            </div>
            <ul className="shop-items">
              {HATS.map((hat) => (
                <li key={hat.id} className={shownHat === hat.id ? "shown" : undefined}>
                  <button type="button" className="shop-try" aria-pressed={shownHat === hat.id} onClick={() => setTrying(hat.id)}>
                    {hat.name}
                    {shop.hat === hat.id && <span className="hint"> · wearing</span>}
                  </button>
                  {owns(hat.id) ? owned : buyButton(hat)}
                </li>
              ))}
            </ul>
            {HATS.some((h) => owns(h.id)) && <p className="hint shop-how">Click Spook to change hats.</p>}
          </>
        )}

        {tab === "decor" && (
          <>
            <ul className="shop-items">
              {DECOR.map((item) => {
                const slot = SLOTS.find((s) => shop.placements[s.id] === item.id);
                return (
                  <li key={item.id}>
                    <img className="shop-thumb" src={item.art} alt="" />
                    <span className="shop-name">
                      {item.name}
                      {owns(item.id) && <span className="hint">{slot ? slot.label : "Not placed yet"}</span>}
                    </span>
                    {owns(item.id) ? owned : buyButton(item)}
                  </li>
                );
              })}
            </ul>
            {DECOR.some((d) => owns(d.id)) && <p className="hint shop-how">Place decorations with the brush button, next to your beans.</p>}
          </>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="actions">
        <span className="spacer" />
        <button type="button" onClick={() => dialog.current?.close()}>Close</button>
      </div>
    </dialog>
  );
}
