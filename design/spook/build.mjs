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
  broom: "#C98F62",
  straw: "#F2C46D",
  strawDark: "#D9A441",
  cup: "#FBF3E6",
  sleeve: "#A8714A",
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
  // Looking down at something held in front of him: shorter eyes, highlights low.
  down: `
  <g id="eyes" fill="${C.ink}">
    <ellipse cx="82" cy="99" rx="9" ry="11"/><ellipse cx="118" cy="99" rx="9" ry="11"/>
    <circle cx="84" cy="104" r="2.5" fill="#fff"/><circle cx="120" cy="104" r="2.5" fill="#fff"/>
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

const headset = (bandPath) => `
  <g id="headphones">${band(bandPath)}${cup(44, 100, 0, "right")}${cup(156, 100, 0, "left")}
  </g>`;
const headphones = headset("M46 92 C40 22 160 22 154 92");
// Over a snug hat the band has to clear its crown (top ≈ y 18), so it arcs higher to the same
// cups. A brimmed hat keeps the usual band, which then reads as crossing in front of the brim.
const headphonesOverHat = headset("M45 94 C33 -8 167 -8 155 94");
const RAISED_BAND = new Set(["beanie"]);

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

// Spook's silhouette as a logo: a sticker on the laptop, the brand mark on the phone's back.
const spookLogo = (id, x, y, { scale = 1, outline = true } = {}) => `
    <g id="${id}" transform="translate(${x} ${y})${scale === 1 ? "" : ` scale(${scale})`}">
      <path d="M0 -12 C9 -12 12 -5 12 2 L12 11 Q8 8 4 11 Q0 14 -4 11 Q-8 8 -12 11 L-12 2 C-12 -5 -9 -12 0 -12 Z"
            fill="${C.body}"${outline ? ` ${line(2.5)}` : ""}/>
      <ellipse cx="-4" cy="-1" rx="2" ry="3" fill="${C.ink}"/><ellipse cx="4" cy="-1" rx="2" ry="3" fill="${C.ink}"/>
    </g>`;

// Seen from behind the lid; the hands reach over its sides to the keyboard.
const laptop = (top = 136, height = 60) => `
  <g id="laptop">
    <rect x="56" y="${top}" width="88" height="${height}" rx="7" fill="${C.laptop}" ${line()}/>
    <rect x="46" y="${top + height - 2}" width="108" height="9" rx="4.5" fill="${C.laptopDark}" ${line(4)}/>${spookLogo("sticker", 100, top + height / 2)}
  </g>`;

// Held upright in both mitts; we see its back: camera bump top left, Spook where the brand mark goes.
const phone = `
  <g id="phone" transform="rotate(-6 100 140)">
    <rect x="80" y="116" width="40" height="50" rx="7" fill="${C.phonesDark}" ${line(4)}/>
    <rect x="84" y="120" width="14" height="14" rx="4" fill="${C.phones}" ${line(2.5)}/>
    <circle cx="88.5" cy="124.5" r="2.2" fill="${C.ink}"/><circle cx="93.5" cy="129.5" r="2.2" fill="${C.ink}"/>
    ${spookLogo("phone-logo", 100, 144, { scale: 0.75, outline: false })}
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

// Hats sit on the dome (its top is y 30). The timer sign hangs just above Spook's head, so they
// hug the head instead of rising tall. Each is written once per pose, with that pose's transform.
const H = { knit: "#E07A5F", knitDark: "#B85A44", knitLight: "#F4A58C", witch: "#4E4384", witchDark: "#3A3168", buckle: "#F2C14E" };
const hats = {
  beanie: `
  <g id="beanie">
    <path d="M50 58 C48 30 72 20 100 20 C128 20 152 30 150 58 Z" fill="${H.knit}" ${line()}/>
    <g fill="none" stroke="${H.knitDark}" stroke-width="3" stroke-linecap="round" opacity="0.55">
      <path d="M76 28 Q72 42 74 54"/><path d="M100 24 V54"/><path d="M124 28 Q128 42 126 54"/>
    </g>
    <rect x="44" y="50" width="112" height="20" rx="10" fill="${H.knitDark}" ${line()}/>
    <g stroke="${H.knitLight}" stroke-width="3" stroke-linecap="round" opacity="0.7">
      ${Array.from({ length: 9 }, (_, i) => `<path d="M${58 + i * 10.5} 56 v8"/>`).join("")}
    </g>
  </g>`,
  // Floppy: a short crown whose point droops down the side, so it all stays below the sign.
  "witch-hat": `
  <g id="witch-hat" transform="rotate(-4 100 46)">
    <path d="M70 44 C70 32 80 24 98 21 C118 18 138 22 152 32 C162 40 168 52 170 66 C160 58 150 52 136 50
             C138 48 132 44 130 44 Z" fill="${H.witch}" ${line()}/>
    <path d="M118 24 C134 26 148 34 156 44" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.25"/>
    <path d="M71 38 Q100 46 129 38 L130 45 Q100 53 70 45 Z" fill="${H.buckle}"/>
    <rect x="93" y="38" width="13" height="11" rx="2" fill="none" stroke="${H.witchDark}" stroke-width="3"/>
    <ellipse cx="100" cy="48" rx="62" ry="9" fill="${H.witch}" ${line()}/>
    <path d="M46 49 Q100 57 154 49" fill="none" stroke="${H.witchDark}" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
  </g>`,
};

// ---------- outside props ----------
// Spook's box sits over the doorway: its opening runs from x ≈ 23 to 177 in his coordinates and
// the cafe floor inside starts at y ≈ 197, so bristles at y ≈ 200–208 touch the floor.

// Held diagonally in both mitts, bristles on the floor to his left. The page swishes this whole
// overlay around the upper mitt (138, 128), so the mitts are drawn here, not on the body.
const broom = `
  <g id="broom">
    <path d="M156 92 L78 186" ${line(9)}/>
    <path d="M156 92 L78 186" stroke="${C.broom}" stroke-width="4" stroke-linecap="round"/>
    <path d="M54 184 h46 l16 24 h-78 Z" fill="${C.straw}" ${line(4)}/>
    <path d="M60 190 l-6 14 M71 190 l-3 15 M82 190 v15 M93 190 l3 15 M102 190 l6 14" stroke="${C.strawDark}" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="58" y="178" width="38" height="9" rx="3" fill="${C.phones}" ${line(3)}/>
  </g>
  ${hand("hand-upper", 138, 114, 40)}${hand("hand-lower", 106, 152, 40)}`;

// Leaning on the inside of the right jamb while he dozes, bristles on the doorway floor (its
// opening ends at x ≈ 177). It doesn't bob, so it's a still props overlay.
const proppedBroom = `
  <g id="propped-broom">
    <path d="M172 44 L160 186" ${line(9)}/>
    <path d="M172 44 L160 186" stroke="${C.broom}" stroke-width="4" stroke-linecap="round"/>
    <path d="M148 184 h24 l4 24 h-32 Z" fill="${C.straw}" ${line(4)}/>
    <path d="M153 190 l-2 14 M160 190 v15 M167 190 l2 14" stroke="${C.strawDark}" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="148" y="180" width="24" height="8" rx="3" fill="${C.phones}" ${line(3)}/>
  </g>`;

// ---------- Mochi, the ghost cat ----------
// Spook's cat: pale, see-through blue with a glowing outline instead of his ink line, so the two
// never merge; a big round head with tall ears, no legs, the body trailing off into a wispy tail.
// Drawn at Spook's scale (the page shows both at 0.75), each in its own box with the base on the
// bottom edge and room around it for the glow, so a scene only needs a position.
const M = { fill: "#E3EAFF", shade: "#C6D3FF", glow: "#7E9BF0", ear: "#F5C6DA", eye: "#3E3A6E", whisker: "#9DB3F5" };
const catSvg = (name, w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <title>Mochi — ${name}</title>
  <defs><filter id="mochi-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.4"/></filter></defs>${body}
</svg>
`;
// The outline twice: blurred and wide for the glow, then crisp on top.
const glowing = (d, fill = M.fill) => `
  <path d="${d}" fill="none" stroke="${M.glow}" stroke-width="7" opacity="0.55" filter="url(#mochi-glow)"/>
  <path d="${d}" fill="${fill}" fill-opacity="0.9" stroke="${M.glow}" stroke-width="3" stroke-linejoin="round"/>`;
const catHead = (cx, cy) =>
  `M${cx - 22} ${cy + 4} C${cx - 24} ${cy - 6} ${cx - 22} ${cy - 14} ${cx - 18} ${cy - 26} L${cx - 6} ${cy - 15}
   C${cx - 2} ${cy - 16} ${cx + 2} ${cy - 16} ${cx + 6} ${cy - 15} L${cx + 18} ${cy - 26}
   C${cx + 22} ${cy - 14} ${cx + 24} ${cy - 6} ${cx + 22} ${cy + 4} C${cx + 22} ${cy + 14} ${cx + 12} ${cy + 20} ${cx} ${cy + 20}
   C${cx - 12} ${cy + 20} ${cx - 22} ${cy + 14} ${cx - 22} ${cy + 4} Z`;
const innerEars = (cx, cy) => `
  <path d="M${cx - 16} ${cy - 18} l-1 -4 l5 4 Z M${cx + 16} ${cy - 18} l1 -4 l-5 4 Z" fill="${M.ear}" stroke="${M.ear}" stroke-width="3" stroke-linejoin="round"/>`;
const whiskers = (cx, cy) => `
  <g stroke="${M.whisker}" stroke-width="1.6" stroke-linecap="round">
    <path d="M${cx - 14} ${cy + 8} l-11 -2 M${cx - 14} ${cy + 11} l-10 2 M${cx + 14} ${cy + 8} l11 -2 M${cx + 14} ${cy + 11} l10 2"/>
  </g>`;
const catMouth = (cx, cy) => `<path d="M${cx - 4} ${cy + 8} q2 3 4 0 q2 3 4 0" fill="none" stroke="${M.eye}" stroke-width="2" stroke-linecap="round"/>`;

// Curled up asleep, head resting on its front, the tail trailing off to the right as a wisp.
const catCurled = catSvg("curled up asleep", 96, 58, `
  ${glowing("M22 52 C10 52 8 40 16 32 C26 22 48 22 62 28 C70 31 74 36 76 42 C82 40 88 36 92 30 C92 40 86 48 76 52 Z")}
  <path d="M40 46 Q54 40 68 46" fill="none" stroke="${M.shade}" stroke-width="3" stroke-linecap="round"/>
  ${glowing(catHead(28, 34))}${innerEars(28, 34)}
  <g fill="none" stroke="${M.eye}" stroke-width="2.2" stroke-linecap="round">
    <path d="M17 34 q4 3 8 0"/><path d="M31 34 q4 3 8 0"/>
  </g>
  ${catMouth(28, 33)}${whiskers(28, 33)}
  <path d="M60 14 q2 -3 4 0 M67 8 q1.5 -2.4 3 0" fill="none" stroke="${M.whisker}" stroke-width="2" stroke-linecap="round"/>`);

// Floating up to Spook's mitt, eyes shut and purring; the body trails down into a wispy tail.
const catPetted = catSvg("being petted", 84, 88, `
  ${glowing("M30 50 C24 58 24 68 30 74 C24 78 14 80 6 82 C18 86 34 84 44 76 C54 72 60 64 60 54 C60 50 58 47 56 46 Z")}
  <path d="M34 60 Q42 66 52 60" fill="none" stroke="${M.shade}" stroke-width="3" stroke-linecap="round"/>
  ${glowing(catHead(42, 34))}${innerEars(42, 34)}
  <g fill="none" stroke="${M.eye}" stroke-width="2.4" stroke-linecap="round">
    <path d="M30 34 q4 -4 8 0"/><path d="M46 34 q4 -4 8 0"/>
  </g>
  ${catMouth(42, 34)}${whiskers(42, 34)}`);

const heart = (x, y, s = 1) =>
  `<path d="M${x} ${y + 4 * s} c${-5 * s} ${-3 * s} ${-6 * s} ${-6 * s} ${-4 * s} ${-8 * s} c${2 * s} ${-2 * s} ${4 * s} ${-1 * s} ${4 * s} ${1 * s} c0 ${-2 * s} ${2 * s} ${-3 * s} ${4 * s} ${-1 * s} c${2 * s} ${2 * s} ${1 * s} ${5 * s} ${-4 * s} ${8 * s} Z" fill="${C.blush}" ${line(1.5)}/>`;

// Reaching down to Mochi on the doorstep, at his lower left; drawn behind the body like the wave.
const petArm = `
  <path id="arm-pet" d="M54 112 C42 116 30 126 22 138 C16 148 26 156 36 150 C44 140 50 132 58 128 Z"
        fill="${C.body}" ${line()}/>`;
const petHearts = `<g id="hearts">${heart(14, 98, 1.2)}${heart(4, 114, 0.9)}${heart(28, 86, 0.8)}</g>`;

const svg = (name, parts, transform = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 210" width="200" height="210">
  <title>Spook — ${name}</title>
  <g id="spook"${transform ? ` transform="${transform}"` : ""}>${parts.join("")}
  </g>
</svg>
`;

// Per scene. A pose is its parts, an optional transform for the whole of Spook, and optional
// `props`: things standing on a table, written to their own overlay so they sit in front of the
// table top and don't bob with Spook.
const poses = {
  counter: {
    idle: { parts: [waveArm, body, eyes.open, blush, mouth.smile, hand("hand-left", 52, 150, -30), waveLines] },
    focus: { parts: [body, headphones, eyes.focused, blush, mouth.small, hand("hand-left", 50, 172, -70), hand("hand-right", 150, 172, 70), laptop()] },
    break: { parts: [body, eyes.happy, blush, mouth.smile, steam(122, 140, 0.55), mug(83, 140), hand("hand-left", 82, 160, -20), hand("hand-right", 120, 160, 20)] },
    sleep: { parts: [body, eyes.asleep, blush, mouth.o, zzz], transform: "rotate(-6 100 110)" },
  },
  // The table top hides Spook below y ≈ 165 (stage y 222), so everything sits higher than at the counter.
  table: {
    idle: { parts: [body, eyes.open, blush, mouth.smile, hand("hand-left", 62, 126, 65), hand("hand-right", 138, 126, -65)], transform: "rotate(4 100 110)" },
    focus: {
      parts: [body, headphones, eyes.focused, blush, mouth.small],
      props: [hand("hand-left", 50, 166, -70), hand("hand-right", 150, 166, 70), laptop(132, 52)],
    },
    break: { parts: [body, eyes.down, blush, phone, hand("hand-left", 78, 158, -40), hand("hand-right", 120, 156, 40)] },
    sleep: {
      parts: [body, eyes.asleep, blush, mouth.o, hand("hand-left", 68, 140, 14), hand("hand-right", 132, 154, 14), zzz],
      transform: "translate(0 16) rotate(-14 100 110)",
    },
  },
  // Floating in the open doorway, nothing in front of him. `held` is a separate overlay that bobs
  // with him (the page also swishes the broom); `props` stand still.
  outside: {
    idle: {
      // Leaning on the left doorframe, one mitt on it, a small wave with the other.
      parts: [waveArm, body, eyes.open, blush, mouth.smile, hand("hand-frame", 34, 124, -80), waveLines],
      transform: "rotate(-6 100 190)",
    },
    // No headphones out here: sweeping the step is focus enough.
    focus: { parts: [body, eyes.focused, blush, mouth.small], held: [broom], transform: "rotate(-3 100 150)" },
    // Petting Mochi, who sits on the doorstep at his lower left.
    break: { parts: [petArm, body, eyes.happy, blush, mouth.smile, hand("hand-pet", 24, 146, -30), petHearts], transform: "rotate(-5 100 190)" },
    sleep: {
      parts: [body, eyes.asleep, blush, mouth.o, hand("hand-left", 56, 150, 20), zzz],
      transform: "rotate(-12 100 190)",
      props: [proppedBroom],
    },
  },
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

// Written straight into the app's assets; design/ keeps only the scripts and previews.
// The counter's poses keep their original names: spook-<pose>.svg, others are spook-<pose>-<scene>.svg.
const dir = new URL("../../src/assets/spook/", import.meta.url).pathname;
let count = 0;
for (const [scene, set] of Object.entries(poses)) {
  for (const [pose, { parts, transform, props, held }] of Object.entries(set)) {
    const name = scene === "counter" ? pose : `${pose}-${scene}`;
    writeFileSync(`${dir}spook-${name}.svg`, svg(name, parts, transform));
    if (props) writeFileSync(`${dir}spook-${name}-props.svg`, svg(`${name} props`, props));
    if (held) writeFileSync(`${dir}spook-${name}-held.svg`, svg(`${name} held`, held, transform));
    count++;
  }
}
// Hats: hat-<hat>-<pose>[-<scene>].svg. While he wears headphones, they go on over the hat.
for (const [hat, art] of Object.entries(hats)) {
  for (const [scene, set] of Object.entries(poses)) {
    for (const [pose, { parts, transform }] of Object.entries(set)) {
      const name = scene === "counter" ? pose : `${pose}-${scene}`;
      const over = RAISED_BAND.has(hat) ? headphonesOverHat : headphones;
      const layers = parts.includes(headphones) ? [art, over] : [art];
      writeFileSync(`${dir}hat-${hat}-${name}.svg`, svg(`${hat}, ${name}`, layers, transform));
    }
  }
}
writeFileSync(`${dir}mochi-curled.svg`, catCurled);
writeFileSync(`${dir}mochi-petted.svg`, catPetted);
// The notes are their own overlay, shown in any awake pose while music plays.
writeFileSync(`${dir}spook-notes.svg`, svg("notes", [notes]));
writeFileSync(new URL("tray-icon.svg", import.meta.url).pathname, trayIcon);
console.log(`wrote ${count} poses to ${dir}`);
