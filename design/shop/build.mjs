// Shop art: the Boo Bean (the currency icon) and the decorations. Hats are drawn per pose by
// design/spook/build.mjs. A decoration is drawn at scene scale (1 unit = 1 stage px) with its
// base on the bottom edge, so a slot only needs a position. Glowing parts go in a separate
// `-glow` file the scene draws above the time-of-day tint.
// Run: node design/shop/build.mjs
import { writeFileSync } from "node:fs";

const ink = "#3E3A6E";
const line = (w = 3) => `stroke="${ink}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const svg = (title, w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <title>${title}</title>${body}
</svg>
`;

// A coffee bean that floats like a ghost: wispy tail, eyes, blush.
const bean = svg("Boo Bean", 32, 32, `
  <path d="M16 2.5 C23.5 2.5 26 9 26 14.5 C26 21 22.5 24.5 19 26.5 Q16 28.5 12.5 30.5 Q13.5 27 11 25.5
           C7.5 23.5 6 19.5 6 14.5 C6 8.5 9 2.5 16 2.5 Z" fill="#8A5A3C" ${line(2.4)}/>
  <path d="M18 5 C13.5 9.5 19.5 14 15.5 21" fill="none" stroke="#6B4A3A" stroke-width="2" stroke-linecap="round"/>
  <circle cx="11.5" cy="13.5" r="1.8" fill="#FFF8EC"/><circle cx="20.5" cy="13.5" r="1.8" fill="#FFF8EC"/>
  <ellipse cx="10" cy="17.5" rx="1.7" ry="1" fill="#F5B3C6"/><ellipse cx="22" cy="17.5" rx="1.7" ry="1" fill="#F5B3C6"/>`);

const P = { body: "#EE8B3A", rib: "#C9682A", light: "#F6AE6A", stem: "#6E8B4E", face: "#5A2E1C", lit: "#FFD878" };
// Shared by both files so the glowing face sits exactly over the dark one.
const face = (fill) => `
    <path d="M13 21 l5 -5 l3 6 Z M35 21 l-5 -5 l-3 6 Z" fill="${fill}"/>
    <path d="M14 28 Q24 34 34 28 L32 32 L28 30 L24 33 L20 30 L16 32 Z" fill="${fill}"/>`;
const PW = 48, PH = 42;
const pumpkin = svg("Jack-o'-lantern", PW, PH, `
  <path d="M24 9 C23 5 25 2 28 1" fill="none" stroke="${P.stem}" stroke-width="4" stroke-linecap="round"/>
  <path d="M24 9 C35 6 46 13 46 25 C46 36 37 40 24 40 C11 40 2 36 2 25 C2 13 13 6 24 9 Z" fill="${P.body}" ${line()}/>
  <path d="M16 10 C10 18 10 32 16 39 M32 10 C38 18 38 32 32 39" fill="none" stroke="${P.rib}" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M8 18 Q6 24 8 30" fill="none" stroke="${P.light}" stroke-width="2.5" stroke-linecap="round"/>${face(P.face)}`);
// Lit from inside: the face glows and a soft halo spills onto the wall around it.
const pumpkinGlow = svg("Jack-o'-lantern glow", PW, PH, `
  <defs><radialGradient id="halo"><stop offset="0" stop-color="${P.lit}" stop-opacity="0.45"/><stop offset="1" stop-color="${P.lit}" stop-opacity="0"/></radialGradient></defs>
  <ellipse cx="24" cy="25" rx="24" ry="17" fill="url(#halo)"/>${face(P.lit)}`);

const dir = new URL("../../src/assets/shop/", import.meta.url).pathname;
writeFileSync(`${dir}bean.svg`, bean);
writeFileSync(`${dir}pumpkin.svg`, pumpkin);
writeFileSync(`${dir}pumpkin-glow.svg`, pumpkinGlow);
console.log(`wrote shop art to ${dir}`);
