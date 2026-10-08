// Builds the cafe scene layers (960×340, all aligned so they stack). The original 480-wide
// scene sits in the middle (drawn in its own coordinates, shifted by OFF); the sides hold
// extra decor that a wider window reveals.
//   room-back.svg   wall, window frame, shelf + TV, string lights (window opening is a hole)
//   room-front.svg  counter, espresso machine, pastry dome — Spook sits between back and front
//   sky-<time>.svg  the pixel-art sky seen through the window
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

// Window opening, in centre-scene coordinates. The sky is only ever seen through here.
const W = { x: 34, y: 44, w: 132, h: 122 };

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
};

// Wallpaper stripes, skipping the window frame so they don't paint over the sky.
const stripes = Array.from({ length: WIDTH / 32 }, (_, i) => i * 32 + 12)
  .filter((x) => x + 10 < OFF + 24 || x > OFF + 176)
  .map((x) => `<rect x="${x}" y="0" width="10" height="200" fill="${C.stripe}"/>`)
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
  <g id="wallpaper">${stripes}</g>
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

// ---------- skies ----------
const P = 4; // one sky pixel, in scene units
const SKY = {
  morning: { bands: ["#F9D3B0", "#FADFC2", "#F6E9D6", "#DCEDF2"], body: "sun", bodyColor: "#FFD36B", cloud: "#FFFFFF", cloudShade: "#F6D6DF", city: "#B7ADC9", lit: null },
  afternoon: { bands: ["#7CC4EC", "#93D0F1", "#AADBF4", "#C2E6F7"], body: "sun", bodyColor: "#FFE58A", cloud: "#FFFFFF", cloudShade: "#D3E9F6", city: "#93A9C6", lit: null },
  evening: { bands: ["#4B3A8C", "#8D4FA4", "#DE6A90", "#F6936B", "#FFC46E"], body: "sunset", bodyColor: "#FFB25B", cloud: "#F28DA8", cloudShade: "#B45C9A", city: "#3A2858", lit: "#FFC46E" },
  night: { bands: ["#211D42", "#29254E", "#322D60", "#3C3772"], body: "moon", bodyColor: "#FAD9A1", cloud: "#8E7CC3", cloudShade: "#F28DA8", city: "#1A1734", lit: "#F7D774" },
};

// Window in sky-pixel units.
const cols = W.w / P, rows = Math.ceil(W.h / P);
const px = (c, r, fill, w = 1, h = 1) => `<rect x="${W.x + c * P}" y="${W.y + r * P}" width="${w * P}" height="${h * P}" fill="${fill}"/>`;

const raster = (cx, cy, rad, keep = () => true) => {
  let out = [];
  for (let r = Math.floor(cy - rad); r <= cy + rad; r++)
    for (let c = Math.floor(cx - rad); c <= cx + rad; c++)
      if ((c + 0.5 - cx) ** 2 + (r + 0.5 - cy) ** 2 <= rad * rad && keep(c, r) && c >= 0 && c < cols && r >= 0 && r < rows) out.push([c, r]);
  return out;
};

// Cloud rows: [offset, length] per row, top to bottom.
const CLOUDS = [
  { c: 2, r: 5, shape: [[3, 4], [1, 9], [0, 12], [2, 9]] },
  { c: 18, r: 11, shape: [[2, 3], [0, 8], [1, 10]] },
];

const city = (t) => {
  const blocks = [[0, 6, 7], [6, 5, 10], [11, 7, 5], [18, 6, 9], [24, 5, 6], [29, 4, 8]];
  let out = "";
  for (const [c, w, h] of blocks) {
    out += px(c, rows - h, t.city, w, h);
    if (t.lit) for (let r = rows - h + 2; r < rows - 1; r += 2) for (let k = c + 1; k < c + w - 1; k += 2)
      if ((k * 7 + r * 3) % 5 < 2) out += px(k, r, t.lit);
  }
  return out;
};

const pixelSky = (t) => {
  const bandH = Math.ceil(rows / t.bands.length);
  let out = t.bands.map((b, i) => px(0, i * bandH, b, cols, bandH)).join("");
  // Dither one pixel row between bands, the classic pixel-art gradient trick.
  t.bands.slice(1).forEach((b, i) => { for (let c = (i % 2); c < cols; c += 2) out += px(c, (i + 1) * bandH - 1, b); });
  if (t.body === "moon") {
    out += raster(25, 7, 4, (c, r) => (c + 0.5 - 27) ** 2 + (r + 0.5 - 5.5) ** 2 > 12).map(([c, r]) => px(c, r, t.bodyColor)).join("");
    for (const [c, r] of [[4, 2], [12, 4], [19, 2], [9, 13], [30, 15], [2, 18]]) out += px(c, r, "#FFF4D6");
  } else if (t.body === "sun") {
    out += raster(26, 6, 4).map(([c, r]) => px(c, r, t.bodyColor)).join("");
  } else {
    out += raster(16, rows - 6, 6, (c, r) => r < rows - 6).map(([c, r]) => px(c, r, t.bodyColor)).join("");
  }
  for (const { c, r, shape } of CLOUDS)
    shape.forEach(([o, len], i) => {
      out += px(c + o, r + i, i === shape.length - 1 ? t.cloudShade : t.cloud, len, 1);
    });
  return out + city(t);
};

const dir = new URL("../../src/assets/cafe/", import.meta.url).pathname;
writeFileSync(`${dir}room-back.svg`, back);
writeFileSync(`${dir}room-front.svg`, front);
for (const [time, t] of Object.entries(SKY)) {
  writeFileSync(`${dir}sky-${time}.svg`, svg(`Sky — ${time}`, centre(pixelSky(t))));
}
console.log(`wrote room layers and ${Object.keys(SKY).length} skies to ${dir}`);
