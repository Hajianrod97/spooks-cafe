// Builds the cafe scene layers (960×340, all aligned so they stack). The original 480-wide
// scene sits in the middle (drawn in its own coordinates, shifted by OFF); the sides hold
// extra decor that a wider window reveals.
// Each scene has a back layer (walls, floor, its window as a hole), a front layer that Spook
// sits behind, and a pixel sky per time of day that only fills its window:
//   room-back.svg, room-front.svg, sky-<time>.svg          the counter
//   tables-back.svg, tables-front.svg, tables-sky-<time>.svg  the window seat
// Time-of-day lighting is a tint overlay applied by the page, so the room is drawn once.
// Run: node design/cafe/build.mjs
import { writeFileSync } from "node:fs";

const ink = "#3E3A6E";
const line = (w = 4) => `stroke="${ink}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const WIDTH = 960;
const OFF = (WIDTH - 480) / 2;
const centre = (body) => `<g transform="translate(${OFF} 0)">${body}</g>`;
const svg = (title, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} 340" width="${WIDTH}" height="340">
  <title>${title}</title>${body}
</svg>
`;

// Window openings, in centre-scene coordinates. The sky is only ever seen through these.
const W = { x: 34, y: 44, w: 132, h: 122 };
// On the far-left wall (centre coordinates, so negative), above the two-seat table. Left to right
// the wall reads: hanging plant, window, lamp, Spook's snapshot, then the timer sign.
const TABLES_W = { x: -156, y: 24, w: 124, h: 128 };

// ---------- room ----------
const C = {
  wall: "#F1E2CF",
  stripe: "#EAD7C0",
  wainscot: "#D8B794",
  wood: "#A8714A",
  woodLight: "#C98F62",
  woodDark: "#7E5136",
  tv: "#E9A27A",
  screen: "#4A4590",
  metal: "#D3D6E4",
  metalDark: "#A9ADC4",
  bulb: "#FFD878",
  plant: "#7DB37C",
  pot: "#D88A69",
  cookie: "#C98A4E",
  floor: "#B9825A",
  floorDark: "#946243",
  booth: "#E9A0B6",
  boothDark: "#C97893",
};

// Wallpaper stripes, skipping a window frame (from x0 to x1 in stage coordinates) so they
// don't paint over the sky.
const stripes = (x0, x1, height) =>
  Array.from({ length: WIDTH / 32 }, (_, i) => i * 32 + 12)
    .filter((x) => x + 10 < x0 || x > x1)
    .map((x) => `<rect x="${x}" y="0" width="10" height="${height}" fill="${C.stripe}"/>`)
    .join("");

const lights = (() => {
  const bulbs = Array.from({ length: 22 }, (_, i) => {
    const x = 20 + i * 44;
    const y = 10 + 14 * Math.sin((Math.PI * ((x % 160) + 0)) / 160);
    return `<g transform="rotate(${i % 2 ? 8 : -8} ${x} ${y})"><rect x="${x - 2.5}" y="${y - 2}" width="5" height="4" fill="${ink}"/>
      <ellipse cx="${x}" cy="${y + 7}" rx="4.5" ry="6" fill="${C.bulb}" ${line(2.5)}/></g>`;
  }).join("");
  return `<g id="string-lights">
    <path d="M0 8 ${Array.from({ length: WIDTH / 160 }, (_, i) => `Q${i * 160 + 80} 34 ${i * 160 + 160} 8`).join(" ")}" fill="none" stroke="${ink}" stroke-width="2.5"/>${bulbs}
  </g>`;
})();

const windowFrame = `
  <g id="window">
    <path fill-rule="evenodd" d="M24 34 H176 V176 H24 Z M${W.x} ${W.y} V${W.y + W.h} H${W.x + W.w} V${W.y} Z"
          fill="${C.wood}" ${line()}/>
    <rect x="${W.x + W.w / 2 - 3}" y="${W.y}" width="6" height="${W.h}" fill="${C.wood}" ${line(3)}/>
    <rect x="${W.x}" y="${W.y + W.h / 2 - 3}" width="${W.w}" height="6" fill="${C.wood}" ${line(3)}/>
    <rect x="16" y="172" width="168" height="12" rx="3" fill="${C.woodLight}" ${line()}/>
    <g id="sill-plant">
      <path d="M40 172 l4 -18 h18 l4 18 Z" fill="${C.pot}" ${line(3)}/>
      <path d="M53 154 q-14 -10 -10 -24 q10 6 10 24 q2 -20 14 -26 q4 14 -14 26" fill="${C.plant}" ${line(3)}/>
    </g>
  </g>`;

const shelf = `
  <g id="shelf">
    <rect x="318" y="150" width="146" height="10" rx="2" fill="${C.woodLight}" ${line()}/>
    <path d="M334 160 v14 l12 -14 M446 160 v14 l-12 -14" fill="${C.wood}" ${line(3)}/>
    <g id="tv">
      <path d="M378 88 L364 62 M402 88 L418 60" fill="none" ${line(3)}/>
      <circle cx="364" cy="62" r="3.5" fill="${ink}"/><circle cx="418" cy="60" r="3.5" fill="${ink}"/>
      <rect x="342" y="86" width="100" height="64" rx="12" fill="${C.tv}" ${line()}/>
      <rect x="351" y="94" width="66" height="48" rx="8" fill="${C.screen}" ${line(3)}/>
      <path d="M357 102 q8 -4 16 -2" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.35"/>
      <path d="M378 108 v20 l16 -10 Z" fill="#B8B1DC"/>
      <circle cx="430" cy="106" r="5" fill="${C.woodDark}" ${line(2.5)}/>
      <circle cx="430" cy="126" r="5" fill="${C.woodDark}" ${line(2.5)}/>
    </g>
    <g id="books">
      <rect x="448" y="112" width="10" height="38" rx="2" fill="#8EC5D6" ${line(2.5)}/>
      <rect x="459" y="120" width="9" height="30" rx="2" fill="#F5B3C6" ${line(2.5)}/>
    </g>
  </g>`;

const signChains = `<path id="sign-chains" d="M196 0 V30 M284 0 V30" stroke="${C.woodDark}" stroke-width="3" stroke-dasharray="5 3"/>`;

const hangingPlant = (x, len) => `
  <g class="hanging-plant">
    <path d="M${x} 0 V${len}" stroke="${ink}" stroke-width="2.5"/>
    <path d="M${x - 16} ${len} h32 l-5 20 h-22 Z" fill="${C.pot}" ${line(3)}/>
    <path d="M${x - 12} ${len + 2} q-8 18 -4 38 M${x - 2} ${len + 4} q-4 26 2 48 M${x + 10} ${len + 2} q8 16 2 32" fill="none" stroke="${C.plant}" stroke-width="5" stroke-linecap="round"/>
    <path d="M${x - 16} ${len + 30} q-6 -2 -6 -8 q6 0 6 8 M${x} ${len + 44} q-6 -2 -6 -8 q6 0 6 8 M${x + 12} ${len + 26} q6 -2 6 -8 q-6 0 -6 8" fill="${C.plant}" ${line(2)}/>
  </g>`;

// Left wall: a framed poster of a coffee cup whose steam is a tiny ghost.
const poster = `
  <g id="poster">
    <rect x="96" y="54" width="96" height="112" rx="4" fill="${C.wood}" ${line()}/>
    <rect x="106" y="64" width="76" height="92" rx="2" fill="#FBF3E6" ${line(3)}/>
    <path d="M124 116 h40 v14 a14 14 0 0 1 -14 14 h-12 a14 14 0 0 1 -14 -14 Z" fill="#86C3D4" ${line(3)}/>
    <path d="M164 120 q10 0 10 8 q0 8 -10 8" fill="none" ${line(3)}/>
    <path d="M144 76 c8 0 12 6 12 14 v18 q-4 -3 -8 0 q-4 3 -8 0 q-4 -3 -8 0 v-18 c0 -8 4 -14 12 -14 Z" fill="#fff" ${line(2.5)}/>
    <ellipse cx="140" cy="90" rx="2" ry="3" fill="${ink}"/><ellipse cx="148" cy="90" rx="2" ry="3" fill="${ink}"/>
  </g>`;

// Right wall: a small framed latte-art heart.
const latteArt = `
  <g id="latte-art">
    <rect x="782" y="70" width="84" height="84" rx="4" fill="${C.wood}" ${line()}/>
    <rect x="792" y="80" width="64" height="64" rx="2" fill="#F5B3C6" ${line(3)}/>
    <circle cx="824" cy="112" r="22" fill="#C98A4E" ${line(3)}/>
    <path d="M824 124 c-12 -8 -14 -14 -10 -18 c4 -4 8 -2 10 2 c2 -4 6 -6 10 -2 c4 4 2 10 -10 18 Z" fill="#FBF3E6"/>
  </g>`;

const back = svg("Cafe — back wall", `
  <path fill-rule="evenodd" d="M0 0 H${WIDTH} V262 H0 Z M${OFF + W.x} ${W.y} V${W.y + W.h} H${OFF + W.x + W.w} V${W.y} Z" fill="${C.wall}"/>
  <g id="wallpaper">${stripes(OFF + 24, OFF + 176, 200)}</g>
  <rect x="0" y="200" width="${WIDTH}" height="62" fill="${C.wainscot}"/>
  <rect x="0" y="196" width="${WIDTH}" height="8" fill="${C.woodLight}" ${line(3)}/>
  ${poster}${latteArt}${hangingPlant(40, 56)}${hangingPlant(920, 70)}
  ${centre(windowFrame + shelf + signChains)}${lights}`);

const espresso = `
  <g id="espresso">
    <rect x="34" y="186" width="92" height="66" rx="10" fill="${C.metal}" ${line()}/>
    <rect x="44" y="196" width="72" height="14" rx="4" fill="${C.metalDark}" ${line(3)}/>
    <circle cx="56" cy="203" r="3" fill="#F28DA8"/><circle cx="68" cy="203" r="3" fill="#86C3D4"/>
    <path d="M70 210 v10 h20 v-10" fill="${C.metalDark}" ${line(3)}/>
    <path d="M62 220 h36" ${line(5)}/>
    <path d="M70 236 h20 v10 a5 5 0 0 1 -5 5 h-10 a5 5 0 0 1 -5 -5 Z" fill="#fff" ${line(3)}/>
    <ellipse cx="80" cy="239" rx="7" ry="2" fill="#6B4A3A"/>
    <path d="M90 239 q6 0 6 5 q0 5 -6 5" fill="none" ${line(2.5)}/>
  </g>`;

const pastry = `
  <g id="pastry">
    <rect x="372" y="246" width="88" height="8" rx="4" fill="#fff" ${line(3)}/>
    <circle cx="398" cy="236" r="10" fill="${C.cookie}" ${line(3)}/>
    <circle cx="396" cy="233" r="1.6" fill="${C.woodDark}"/><circle cx="402" cy="238" r="1.6" fill="${C.woodDark}"/>
    <path d="M412 246 q4 -22 22 -20 q14 2 16 20 Z" fill="#E9B872" ${line(3)}/>
    <path d="M424 228 q-2 8 0 18 M436 226 q2 8 0 20" fill="none" ${line(2)} opacity="0.6"/>
    <path d="M378 246 Q378 196 416 196 Q454 196 454 246" fill="#E8F4F8" fill-opacity="0.35" ${line(3)}/>
    <circle cx="416" cy="193" r="5" fill="#fff" ${line(3)}/>
    <path d="M390 226 q2 -16 16 -22" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
  </g>`;

const cups = `
  <g id="cups">
    <path d="M62 252 l4 -16 h28 l4 16 Z" fill="#fff" ${line(3)}/>
    <path d="M64 236 l4 -16 h24 l4 16 Z" fill="#F5B3C6" ${line(3)}/>
    <path d="M66 220 l4 -14 h20 l4 14 Z" fill="#86C3D4" ${line(3)}/>
  </g>
  <g id="sugar">
    <rect x="128" y="214" width="40" height="38" rx="10" fill="#E8F4F8" fill-opacity="0.6" ${line(3)}/>
    <rect x="134" y="226" width="28" height="22" rx="4" fill="#fff"/>
    <rect x="132" y="206" width="32" height="10" rx="4" fill="${C.pot}" ${line(3)}/>
    <circle cx="148" cy="203" r="4" fill="${C.pot}" ${line(2.5)}/>
  </g>`;

const register = `
  <g id="register">
    <rect x="796" y="186" width="56" height="22" rx="4" fill="${C.screen}" ${line(3)}/>
    <path d="M806 197 h18" stroke="#F7D774" stroke-width="3" stroke-linecap="round"/>
    <path d="M784 252 l8 -46 h64 l8 46 Z" fill="${C.tv}" ${line()}/>
    ${[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => `<rect x="${800 + c * 12}" y="${214 + r * 10}" width="8" height="6" rx="1.5" fill="#FBF3E6"/>`).join("")).join("")}
  </g>
  <g id="tip-jar">
    <path d="M892 252 v-30 q0 -6 6 -6 h28 q6 0 6 6 v30 Z" fill="#E8F4F8" fill-opacity="0.55" ${line(3)}/>
    <circle cx="904" cy="244" r="5" fill="#F7D774" ${line(2)}/><circle cx="917" cy="246" r="5" fill="#F7D774" ${line(2)}/>
    <path d="M912 236 c-6 -4 -7 -7 -5 -9 c2 -2 4 -1 5 1 c1 -2 3 -3 5 -1 c2 2 1 5 -5 9 Z" fill="#F28DA8"/>
  </g>`;

const slats = Array.from({ length: WIDTH / 44 + 1 }, (_, i) => `<path d="M${i * 44 + 22} 270 V340" stroke="${C.woodDark}" stroke-width="3" opacity="0.45"/>`).join("");

const front = svg("Cafe — counter", `
  ${cups}${register}${centre(espresso + pastry)}
  <rect x="-4" y="262" width="${WIDTH + 8}" height="82" fill="${C.wood}" ${line()}/>
  ${slats}
  <rect x="-4" y="250" width="${WIDTH + 8}" height="14" rx="3" fill="${C.woodLight}" ${line()}/>`);

// ---------- tables: the window seat ----------
const TW = TABLES_W;

// The big window, with a transom across the top.
const bigWindow = `
  <g id="big-window">
    <path fill-rule="evenodd" d="M${TW.x - 10} ${TW.y - 10} H${TW.x + TW.w + 10} V${TW.y + TW.h + 10} H${TW.x - 10} Z
          M${TW.x} ${TW.y} V${TW.y + TW.h} H${TW.x + TW.w} V${TW.y} Z" fill="${C.wood}" ${line()}/>
    <rect x="${TW.x + TW.w / 3 - 3}" y="${TW.y + 36}" width="6" height="${TW.h - 36}" fill="${C.wood}" ${line(3)}/>
    <rect x="${TW.x + (2 * TW.w) / 3 - 3}" y="${TW.y + 36}" width="6" height="${TW.h - 36}" fill="${C.wood}" ${line(3)}/>
    <rect x="${TW.x}" y="${TW.y + 33}" width="${TW.w}" height="6" fill="${C.wood}" ${line(3)}/>
    <rect x="${TW.x - 14}" y="${TW.y + TW.h + 6}" width="${TW.w + 28}" height="12" rx="3" fill="${C.woodLight}" ${line()}/>
  </g>`;

const pendant = (x) => `
  <g class="pendant">
    <path d="M${x} 0 V42" stroke="${ink}" stroke-width="2.5"/>
    <path d="M${x - 18} 62 Q${x - 16} 42 ${x} 42 Q${x + 16} 42 ${x + 18} 62 Z" fill="#86C3D4" ${line(3)}/>
    <ellipse cx="${x}" cy="64" rx="6" ry="4" fill="${C.bulb}" ${line(2.5)}/>
  </g>`;

// Left of the sign: a framed snapshot of Spook on the cafe's opening day (drawn centred on x 415).
const snapshot = `
  <g id="snapshot" transform="translate(-318 0)">
    <rect x="378" y="74" width="74" height="84" rx="3" fill="#FBF3E6" ${line()} transform="rotate(4 415 116)"/>
    <g transform="rotate(4 415 116)">
      <rect x="386" y="82" width="58" height="52" fill="#86C3D4" ${line(2.5)}/>
      <path d="M415 92 c10 0 14 7 14 16 v18 q-4 -3 -8 0 q-3 3 -6 0 q-3 -3 -6 0 q-4 3 -8 0 v-18 c0 -9 4 -16 14 -16 Z" fill="#fff" ${line(2.5)}/>
      <ellipse cx="410" cy="106" rx="2" ry="3" fill="${ink}"/><ellipse cx="420" cy="106" rx="2" ry="3" fill="${ink}"/>
      <path d="M398 144 h34" stroke="${ink}" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
    </g>
  </g>`;

// A bentwood chair seen from the front: hooped back with two rails, round seat, two legs.
// `scale` shrinks it for tables further back; at 1 it's the empty chair at Spook's table.
const frontChair = (cx, seatY, floorY, scale = 1) => {
  const k = (n) => +(n * scale).toFixed(1);
  return `
  <g class="chair">
    <path d="M${cx - k(17)} ${seatY - k(96)} V${seatY} M${cx + k(17)} ${seatY - k(96)} V${seatY}" ${line(7)}/>
    <path d="M${cx - k(21)} ${seatY - k(94)} Q${cx} ${seatY - k(108)} ${cx + k(21)} ${seatY - k(94)}" fill="none" ${line(7)}/>
    <path d="M${cx - k(14)} ${seatY - k(78)} H${cx + k(14)} M${cx - k(14)} ${seatY - k(60)} H${cx + k(14)}" ${line(4)}/>
    <ellipse cx="${cx}" cy="${seatY}" rx="${k(30)}" ry="${k(9)}" fill="${C.wood}" ${line()}/>
    <path d="M${cx - k(21)} ${seatY + k(6)} V${floorY} M${cx + k(21)} ${seatY + k(6)} V${floorY}" ${line(5)}/>
  </g>`;
};

// Left side: a two-seat table under the window, someone's cup and book left behind.
// Right of the sign: a moonlit painting (drawn at x 76, moved by `x`).
const moonPainting = (x) => `
  <g id="moon-painting" transform="translate(${x - 76} 0)">
    <rect x="76" y="64" width="84" height="70" rx="4" fill="${C.wood}" ${line()}/>
    <rect x="86" y="74" width="64" height="50" rx="2" fill="#3C3772" ${line(3)}/>
    <circle cx="132" cy="92" r="9" fill="#FAD9A1"/><circle cx="136" cy="89" r="8" fill="#3C3772"/>
    <path d="M86 112 q16 -10 32 -2 q16 8 32 -4 V124 H86 Z" fill="#29254E"/>
  </g>`;

const leftTable = `
  <g id="left-table">
    ${frontChair(40, 272, 322, 0.8)}${frontChair(208, 272, 322, 0.8)}
    <rect x="64" y="236" width="120" height="10" rx="3" fill="${C.woodLight}" ${line()}/>
    <path d="M78 246 V320 M170 246 V320" ${line(6)}/>
    <path d="M92 236 h18 v-10 a4 4 0 0 0 -4 -4 h-10 a4 4 0 0 0 -4 4 Z" fill="#F5B3C6" ${line(2.5)}/>
    <path d="M110 226 q6 0 6 5 q0 4 -6 4" fill="none" ${line(2.5)}/>
    <path d="M126 236 l2 -8 q12 -4 22 2 q10 -6 22 -2 l2 8 Z" fill="#FBF3E6" ${line(2.5)}/>
    <path d="M150 230 v6" ${line(2)}/>
  </g>`;

// Right side: a booth with a reserved card, a bookshelf above and a plant on a stand.
const bookshelf = `
  <g id="bookshelf">
    ${[0, 1].map((r) => {
      const y = 92 + r * 46;
      const books = [["#86C3D4", 10, 34], ["#F5B3C6", 8, 30], ["#F2C46D", 11, 36], ["#B8B1DC", 9, 28], ["#9ED6A5", 10, 33], ["#E9A27A", 8, 30]]
        .map(([fill, w, h], i) => `<rect x="${778 + i * 14 + r * 30}" y="${y - h}" width="${w}" height="${h}" rx="2" fill="${fill}" ${line(2.5)}/>`)
        .join("");
      return books + `<rect x="768" y="${y}" width="150" height="8" rx="2" fill="${C.woodLight}" ${line(3)}/>`;
    }).join("")}
  </g>`;

const booth = `
  <g id="booth">
    <path d="M744 262 V196 Q744 176 764 176 H916 Q936 176 936 196 V262 Z" fill="${C.booth}" ${line()}/>
    <path d="M790 182 V254 M840 182 V254 M890 182 V254" stroke="${C.boothDark}" stroke-width="3" stroke-linecap="round"/>
    <rect x="736" y="250" width="208" height="16" rx="5" fill="${C.boothDark}" ${line()}/>
    <rect x="770" y="232" width="140" height="10" rx="3" fill="${C.woodLight}" ${line()}/>
    <path d="M840 242 V322" ${line(7)}/>
    <ellipse cx="840" cy="324" rx="26" ry="6" fill="${C.woodDark}" ${line(3)}/>
    <path d="M852 232 l8 -18 l8 18 Z" fill="#fff" ${line(2.5)}/>
    <path d="M856 226 h8" stroke="${C.boothDark}" stroke-width="2" stroke-linecap="round"/>
  </g>
  <g id="plant-stand">
    <path d="M700 322 l6 -64 h28 l6 64" fill="none" ${line(4)}/>
    <rect x="698" y="250" width="44" height="10" rx="3" fill="${C.woodLight}" ${line(3)}/>
    <path d="M706 250 l4 -22 h20 l4 22 Z" fill="${C.pot}" ${line(3)}/>
    <path d="M720 228 q-22 -16 -18 -40 q14 10 18 40 q0 -34 16 -44 q8 22 -16 44 q10 -26 28 -26 q-4 22 -28 26" fill="${C.plant}" ${line(3)}/>
  </g>`;

const floorboards = `
  <rect x="0" y="230" width="${WIDTH}" height="110" fill="${C.floor}"/>
  ${[252, 278, 308].map((y) => `<path d="M0 ${y} H${WIDTH}" stroke="${C.floorDark}" stroke-width="2.5" opacity="0.6"/>`).join("")}
  ${Array.from({ length: 24 }, (_, i) => {
    const row = i % 3, y = [230, 252, 278][row], h = [22, 26, 30][row];
    const x = (Math.floor(i / 3) * 128 + row * 47) % WIDTH;
    return `<path d="M${x} ${y} v${h}" stroke="${C.floorDark}" stroke-width="2.5" opacity="0.6"/>`;
  }).join("")}
  <rect x="0" y="226" width="${WIDTH}" height="6" fill="${C.woodDark}" ${line(3)}/>`;

const tablesBack = svg("Cafe — window seat, back", `
  <path fill-rule="evenodd" d="M0 0 H${WIDTH} V230 H0 Z M${OFF + TW.x} ${TW.y} V${TW.y + TW.h} H${OFF + TW.x + TW.w} V${TW.y} Z" fill="${C.wall}"/>
  <g id="wallpaper">${stripes(OFF + TW.x - 20, OFF + TW.x + TW.w + 20, 196)}</g>
  <rect x="0" y="196" width="${WIDTH}" height="34" fill="${C.wainscot}"/>
  <rect x="0" y="192" width="${WIDTH}" height="8" fill="${C.woodLight}" ${line(3)}/>
  ${floorboards}
  ${centre(bigWindow + snapshot + pendant(18) + signChains)}
  ${leftTable}${moonPainting(600)}${bookshelf}${booth}${hangingPlant(30, 60)}${lights}`);

// Spook's round table, with the empty chair turned towards the viewer. Spook floats behind it.
const spooksTable = `
  <g id="spooks-table">
    ${frontChair(389, 292, 336)}
    <path d="M232 254 H248 V322 H232 Z" fill="${C.woodDark}" ${line(3)}/>
    <ellipse cx="240" cy="326" rx="36" ry="8" fill="${C.woodDark}" ${line(3)}/>
    <!-- The top hides Spook below y ≈ 258, the way the counter does. -->
    <ellipse cx="240" cy="246" rx="106" ry="18" fill="${C.wood}" ${line()}/>
    <ellipse cx="240" cy="240" rx="106" ry="18" fill="${C.woodLight}" ${line()}/>
    <g id="bud-vase">
      <path d="M160 240 q-6 -10 0 -18 h8 q6 8 0 18 Z" fill="#B8B1DC" ${line(2.5)}/>
      <path d="M164 222 q-2 -12 4 -20" fill="none" stroke="${C.plant}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="169" cy="200" r="5" fill="#F28DA8" ${line(2)}/>
    </g>
  </g>`;

const tablesFront = svg("Cafe — window seat, front", centre(spooksTable));

// ---------- skies ----------
const P = 4; // one sky pixel, in scene units
const SKY = {
  morning: { bands: ["#F9D3B0", "#FADFC2", "#F6E9D6", "#DCEDF2"], body: "sun", bodyColor: "#FFD36B", cloud: "#FFFFFF", cloudShade: "#F6D6DF", city: "#B7ADC9", lit: null },
  afternoon: { bands: ["#7CC4EC", "#93D0F1", "#AADBF4", "#C2E6F7"], body: "sun", bodyColor: "#FFE58A", cloud: "#FFFFFF", cloudShade: "#D3E9F6", city: "#93A9C6", lit: null },
  evening: { bands: ["#4B3A8C", "#8D4FA4", "#DE6A90", "#F6936B", "#FFC46E"], body: "sunset", bodyColor: "#FFB25B", cloud: "#F28DA8", cloudShade: "#B45C9A", city: "#3A2858", lit: "#FFC46E" },
  night: { bands: ["#211D42", "#29254E", "#322D60", "#3C3772"], body: "moon", bodyColor: "#FAD9A1", cloud: "#8E7CC3", cloudShade: "#F28DA8", city: "#1A1734", lit: "#F7D774" },
};

// Patterns below are drawn for the counter's 33-pixel-wide window; wider windows repeat them.
const TILE = 33;
const STARS = [[4, 2], [12, 4], [19, 2], [9, 13], [30, 15], [2, 18]];
// Cloud rows: [offset, length] per row, top to bottom.
const CLOUDS = [
  { c: 2, r: 5, shape: [[3, 4], [1, 9], [0, 12], [2, 9]] },
  { c: 18, r: 11, shape: [[2, 3], [0, 8], [1, 10]] },
];
const BLOCKS = [[0, 6, 7], [6, 5, 10], [11, 7, 5], [18, 6, 9], [24, 5, 6], [29, 4, 8]];

/** A pixel-art sky filling window `win` (centre-scene coordinates). */
const pixelSky = (t, win) => {
  const cols = win.w / P, rows = Math.ceil(win.h / P);
  const px = (c, r, fill, w = 1, h = 1) => {
    if (c >= cols || r >= rows) return "";
    const width = Math.min(w, cols - c), height = Math.min(h, rows - r);
    return `<rect x="${win.x + c * P}" y="${win.y + r * P}" width="${width * P}" height="${height * P}" fill="${fill}"/>`;
  };
  const raster = (cx, cy, rad, keep = () => true) => {
    const out = [];
    for (let r = Math.floor(cy - rad); r <= cy + rad; r++)
      for (let c = Math.floor(cx - rad); c <= cx + rad; c++)
        if ((c + 0.5 - cx) ** 2 + (r + 0.5 - cy) ** 2 <= rad * rad && keep(c, r) && c >= 0 && c < cols && r >= 0 && r < rows) out.push([c, r]);
    return out;
  };
  const tiles = Array.from({ length: Math.ceil(cols / TILE) }, (_, i) => i * TILE);

  const bandH = Math.ceil(rows / t.bands.length);
  let out = t.bands.map((b, i) => px(0, i * bandH, b, cols, bandH)).join("");
  // Dither one pixel row between bands, the classic pixel-art gradient trick.
  t.bands.slice(1).forEach((b, i) => { for (let c = (i % 2); c < cols; c += 2) out += px(c, (i + 1) * bandH - 1, b); });
  if (t.body === "moon") {
    const mc = cols - 8;
    out += raster(mc, 7, 4, (c, r) => (c + 0.5 - (mc + 2)) ** 2 + (r + 0.5 - 5.5) ** 2 > 12).map(([c, r]) => px(c, r, t.bodyColor)).join("");
    for (const base of tiles) for (const [c, r] of STARS) out += px(base + c, r, "#FFF4D6");
  } else if (t.body === "sun") {
    out += raster(cols - 7, 6, 4).map(([c, r]) => px(c, r, t.bodyColor)).join("");
  } else {
    out += raster(Math.floor(cols / 2), rows - 6, 6, (c, r) => r < rows - 6).map(([c, r]) => px(c, r, t.bodyColor)).join("");
  }
  for (const base of tiles)
    for (const { c, r, shape } of CLOUDS)
      shape.forEach(([o, len], i) => {
        out += px(base + c + o, r + i, i === shape.length - 1 ? t.cloudShade : t.cloud, len, 1);
      });
  for (const base of tiles)
    for (const [c, w, h] of BLOCKS) {
      out += px(base + c, rows - h, t.city, w, h);
      if (t.lit) for (let r = rows - h + 2; r < rows - 1; r += 2) for (let k = base + c + 1; k < base + c + w - 1; k += 2)
        if ((k * 7 + r * 3) % 5 < 2) out += px(k, r, t.lit);
    }
  return out;
};

const dir = new URL("../../src/assets/cafe/", import.meta.url).pathname;
writeFileSync(`${dir}room-back.svg`, back);
writeFileSync(`${dir}room-front.svg`, front);
writeFileSync(`${dir}tables-back.svg`, tablesBack);
writeFileSync(`${dir}tables-front.svg`, tablesFront);
for (const [time, t] of Object.entries(SKY)) {
  writeFileSync(`${dir}sky-${time}.svg`, svg(`Sky — ${time}`, centre(pixelSky(t, W))));
  writeFileSync(`${dir}tables-sky-${time}.svg`, svg(`Tables sky — ${time}`, centre(pixelSky(t, TABLES_W))));
}
console.log(`wrote both scenes' layers and ${Object.keys(SKY).length} skies each to ${dir}`);
