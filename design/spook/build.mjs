// Assembles Spook's pose SVGs from shared parts so every pose stays on-model.
// Run: node design/spook/build.mjs
import { writeFileSync } from "node:fs";

const C = {
  ink: "#3E3A6E",
  body: "#FFF8EC",
  shade: "#E4DEF4",
  blush: "#F5B3C6",
  phones: "#7B6CC0",
  phonesDark: "#5A4C9E",
  mug: "#86C3D4",
  mugDark: "#5FA3B8",
  coffee: "#6B4A3A",
  steam: "#B8B1DC",
  laptop: "#CDD1E2",
  laptopDark: "#A9AEC6",
};
const line = (w = 5) => `stroke="${C.ink}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

const body = `
  <g id="body">
    <path d="M100 30 C142 30 158 62 158 104 L159 160 Q165 184 148 182 Q138 174 127 186
             Q114 197 101 185 Q89 174 76 186 Q62 197 52 182 Q35 184 41 160 L42 104
             C42 62 58 30 100 30 Z" fill="${C.body}" ${line()}/>
    <path d="M48 166 Q60 176 72 168 Q86 158 100 170 Q114 158 128 168 Q140 176 152 166 L153 174
             Q140 168 127 180 Q114 190 101 179 Q89 168 76 180 Q62 190 49 174 Z"
          fill="${C.shade}" opacity="0.9"/>
    <path d="M128 60 Q140 72 142 92" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="0.9"/>
  </g>`;

const eyes = {
  open: `
  <g id="eyes" fill="${C.ink}">
    <ellipse cx="82" cy="96" rx="9" ry="13"/><ellipse cx="118" cy="96" rx="9" ry="13"/>
    <circle cx="85" cy="90" r="3" fill="#fff"/><circle cx="121" cy="90" r="3" fill="#fff"/>
  </g>`,
  focused: `
  <g id="eyes" fill="${C.ink}">
    <path d="M73 92 L91 92 L91 99 A9 9 0 0 1 73 99 Z"/><path d="M109 92 L127 92 L127 99 A9 9 0 0 1 109 99 Z"/>
  </g>`,
  happy: `
  <g id="eyes" fill="none" ${line()}>
    <path d="M74 99 Q82 87 90 99"/><path d="M110 99 Q118 87 126 99"/>
  </g>`,
  asleep: `
  <g id="eyes" fill="none" ${line()}>
    <path d="M74 96 Q82 104 90 96"/><path d="M110 96 Q118 104 126 96"/>
  </g>`,
};

const blush = `
  <g id="blush" fill="${C.blush}" opacity="0.75">
    <ellipse cx="68" cy="114" rx="8" ry="4.5"/><ellipse cx="132" cy="114" rx="8" ry="4.5"/>
  </g>`;

const mouth = {
  smile: `<path id="mouth" d="M93 118 Q100 125 107 118" fill="none" ${line(4)}/>`,
  small: `<path id="mouth" d="M96 119 Q100 122 104 119" fill="none" ${line(4)}/>`,
  o: `<ellipse id="mouth" cx="100" cy="120" rx="3.5" ry="4.5" fill="${C.ink}"/>`,
};

// One ear cup: outlined shell with a darker cushion facing the head.
const cup = (cx, cy, rot, cushionSide) => `
    <g transform="rotate(${rot} ${cx} ${cy})">
      <rect x="${cx - 14}" y="${cy - 21}" width="28" height="42" rx="13" fill="${C.phones}" ${line()}/>
      <rect x="${cx + (cushionSide === "right" ? 2 : -10)}" y="${cy - 13}" width="8" height="26" rx="4" fill="${C.phonesDark}"/>
      <path d="M${cx - 6} ${cy - 13} v10" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.5"/>
    </g>`;

const band = (d) => `
    <path d="${d}" fill="none" stroke="${C.ink}" stroke-width="18" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="${C.phones}" stroke-width="10" stroke-linecap="round"/>`;

const headphones = `
  <g id="headphones">${band("M46 92 C40 22 160 22 154 92")}${cup(44, 100, 0, "right")}${cup(156, 100, 0, "left")}
  </g>`;

const steam = (x, y, scale = 1) => `
  <g id="steam" transform="translate(${x} ${y}) scale(${scale}) translate(${-x} ${-y})" fill="none" stroke="${C.steam}" stroke-width="4" stroke-linecap="round">
    <path d="M${x - 7} ${y} q-5 -8 0 -15 q5 -7 0 -14"/>
    <path d="M${x + 5} ${y - 3} q-5 -8 0 -15 q5 -7 0 -14"/>
  </g>`;

const mug = (x, y) => `
  <g id="mug">
    <path d="M${x + 30} ${y + 8} q14 0 14 12 q0 12 -14 12" fill="none" stroke="${C.ink}" stroke-width="11"/>
    <path d="M${x + 30} ${y + 8} q14 0 14 12 q0 12 -14 12" fill="none" stroke="${C.mug}" stroke-width="4"/>
    <path d="M${x} ${y} h34 v26 a10 10 0 0 1 -10 10 h-14 a10 10 0 0 1 -10 -10 Z" fill="${C.mug}" ${line()}/>
    <path d="M${x + 3} ${y + 26} h28" stroke="${C.mugDark}" stroke-width="4" stroke-linecap="round" opacity="0.6"/>
    <ellipse cx="${x + 17}" cy="${y + 2}" rx="14" ry="3" fill="${C.coffee}"/>
  </g>`;

// A mitten of sheet drawn in front of the body, standing in for a hand.
const hand = (id, cx, cy, rot = 0) =>
  `<g id="${id}" transform="rotate(${rot} ${cx} ${cy})">
    <ellipse cx="${cx}" cy="${cy}" rx="11" ry="8" fill="${C.body}" ${line(4)}/>
    <path d="M${cx - 7} ${cy + 3} q7 4 14 0" fill="none" stroke="${C.shade}" stroke-width="3" stroke-linecap="round"/>
  </g>`;

// Drawn behind the body so the body's outline hides where the sleeve joins it.
const waveArm = `
  <path id="arm-wave" d="M150 124 C162 118 164 104 165 94 C166 78 192 76 193 94 C194 116 184 144 154 166 Z"
        fill="${C.body}" ${line()}/>`;

const waveLines = `
  <g id="wave-lines" fill="none" stroke="${C.steam}" stroke-width="3.5" stroke-linecap="round">
    <path d="M164 68 q4 -8 12 -10"/><path d="M196 74 q2 -8 -2 -14"/>
  </g>`;

// Seen from behind the lid; the hands reach over its sides to the keyboard.
const laptop = `
  <g id="laptop">
    <rect x="56" y="136" width="88" height="60" rx="7" fill="${C.laptop}" ${line()}/>
    <rect x="46" y="194" width="108" height="9" rx="4.5" fill="${C.laptopDark}" ${line(4)}/>
    <g id="sticker" transform="translate(100 166)">
      <path d="M0 -12 C9 -12 12 -5 12 2 L12 11 Q8 8 4 11 Q0 14 -4 11 Q-8 8 -12 11 L-12 2 C-12 -5 -9 -12 0 -12 Z"
            fill="${C.body}" ${line(2.5)}/>
      <ellipse cx="-4" cy="-1" rx="2" ry="3" fill="${C.ink}"/><ellipse cx="4" cy="-1" rx="2" ry="3" fill="${C.ink}"/>
    </g>
  </g>`;

const zzz = `
  <g id="zzz" fill="${C.steam}" font-family="ui-rounded, 'SF Pro Rounded', system-ui" font-weight="800">
    <text x="148" y="52" font-size="22">z</text>
    <text x="164" y="36" font-size="16">z</text>
    <text x="176" y="24" font-size="12">z</text>
  </g>`;

const notes = `
  <g id="notes" fill="${C.phones}" opacity="0.8">
    <path d="M18 60 v-22 l14 -4 v20" fill="none" stroke="${C.phones}" stroke-width="3.5" stroke-linejoin="round"/>
    <ellipse cx="15" cy="60" rx="5" ry="4"/><ellipse cx="29" cy="54" rx="5" ry="4"/>
    <path d="M182 74 v-20" stroke="${C.phones}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M182 54 q8 4 6 12" fill="none" stroke="${C.phones}" stroke-width="3.5" stroke-linecap="round"/>
    <ellipse cx="178" cy="75" rx="5" ry="4"/>
  </g>`;

const svg = (name, parts, transform = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 210" width="200" height="210">
  <title>Spook — ${name}</title>
  <g id="spook"${transform ? ` transform="${transform}"` : ""}>${parts.join("")}
  </g>
</svg>
`;

const poses = {
  idle: [waveArm, body, eyes.open, blush, mouth.smile, hand("hand-left", 52, 150, -30), waveLines],
  focus: [body, headphones, eyes.focused, blush, mouth.small, hand("hand-left", 50, 172, -70), hand("hand-right", 150, 172, 70), laptop, notes],
  break: [body, eyes.happy, blush, mouth.smile, steam(122, 140, 0.55), mug(83, 140), hand("hand-left", 82, 160, -20), hand("hand-right", 120, 160, 20)],
  sleep: [body, eyes.asleep, blush, mouth.o, zzz],
};

// Menu bar icon: a solid silhouette with the eyes cut out. macOS treats it as a template
// image and recolours it to match the menu bar, so only the alpha channel matters.
const trayIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="32 24 136 170" width="54" height="68">
  <mask id="eyes-cut"><rect x="0" y="0" width="200" height="210" fill="#fff"/>
    <ellipse cx="80" cy="98" rx="12" ry="17" fill="#000"/><ellipse cx="120" cy="98" rx="12" ry="17" fill="#000"/></mask>
  <path mask="url(#eyes-cut)" d="M100 30 C142 30 158 62 158 104 L159 160 Q165 184 148 182 Q138 174 127 186
           Q114 197 101 185 Q89 174 76 186 Q62 197 52 182 Q35 184 41 160 L42 104 C42 62 58 30 100 30 Z"
        fill="#000" stroke="#000" stroke-width="8" stroke-linejoin="round"/>
</svg>
`;

const tilt = { sleep: "rotate(-6 100 110)" };
// Written straight into the app's assets; design/ keeps only the scripts and previews.
const dir = new URL("../../src/assets/spook/", import.meta.url).pathname;
for (const [name, parts] of Object.entries(poses)) {
  writeFileSync(`${dir}spook-${name}.svg`, svg(name, parts, tilt[name]));
}
writeFileSync(new URL("tray-icon.svg", import.meta.url).pathname, trayIcon);
console.log(`wrote ${Object.keys(poses).length} poses to ${dir}`);
