// Original, on-brand SVG illustrations for the demo catalogue (no stock photos, no third-party assets).
// Every motif is drawn in an 800x800 space; banners compose several motifs on a wide canvas.

export type Motif =
  | "diya" | "kalash" | "bell" | "incense" | "thali" | "idol" | "mala" | "kumkum" | "camphor"
  | "havan" | "samai" | "kit" | "garland" | "conch" | "dhoop" | "chowki";

export type Palette = { bg: string; halo: string; metal: string; metalDark: string; accent: string };

export const PALETTES: Record<string, Palette> = {
  saffron: { bg: "#fff7ed", halo: "#fed7aa", metal: "#d9b13a", metalDark: "#9a7623", accent: "#d9600b" },
  sandal: { bg: "#fbf6ec", halo: "#f4ead7", metal: "#c19a2e", metalDark: "#77591f", accent: "#a82a30" },
  kumkum: { bg: "#fdf3f3", halo: "#f6c8c8", metal: "#d9b13a", metalDark: "#9a7623", accent: "#a82a30" },
  tulsi: { bg: "#f2f7f2", halo: "#e0ece0", metal: "#c19a2e", metalDark: "#77591f", accent: "#4f7f55" },
  gold: { bg: "#fdf9e9", halo: "#faf0c4", metal: "#c19a2e", metalDark: "#77591f", accent: "#b44809" },
};

const flame = (x: number, y: number, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <path d="M0 -70 C 26 -36 30 -10 0 10 C -30 -10 -26 -36 0 -70 Z" fill="url(#flameOuter)"/>
    <path d="M0 -40 C 12 -22 14 -8 0 4 C -14 -8 -12 -22 0 -40 Z" fill="#fff3c4"/>
  </g>`;

const defs = (p: Palette) => `
  <defs>
    <radialGradient id="flameOuter" cx="50%" cy="70%" r="60%"><stop offset="0%" stop-color="#ffd166"/><stop offset="100%" stop-color="#f27a1a"/></radialGradient>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${p.metal}"/><stop offset="55%" stop-color="#f5e08c"/><stop offset="100%" stop-color="${p.metalDark}"/></linearGradient>
    <linearGradient id="clay" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#c8693a"/><stop offset="100%" stop-color="#8f380f"/></linearGradient>
    <radialGradient id="glow" cx="50%" cy="45%" r="55%"><stop offset="0%" stop-color="#ffffff" stop-opacity=".9"/><stop offset="100%" stop-color="${p.halo}" stop-opacity="0"/></radialGradient>
  </defs>`;

const MOTIFS: Record<Motif, (p: Palette) => string> = {
  diya: () => `
    <path d="M190 500 Q400 720 610 500 Q520 540 400 540 Q280 540 190 500 Z" fill="url(#clay)"/>
    <path d="M190 500 Q400 560 610 500" fill="none" stroke="#742f10" stroke-width="8"/>
    <path d="M560 505 Q640 470 660 440 Q630 500 590 520 Z" fill="url(#clay)"/>
    ${flame(400, 470, 1.6)}`,
  kalash: (p) => `
    <ellipse cx="400" cy="520" rx="170" ry="150" fill="url(#metal)"/>
    <path d="M290 410 Q400 440 510 410 L480 360 Q400 380 320 360 Z" fill="${p.metalDark}"/>
    <ellipse cx="400" cy="355" rx="110" ry="22" fill="url(#metal)"/>
    ${[-60, -25, 10, 45].map((a) => `<ellipse cx="400" cy="300" rx="22" ry="80" fill="#4f7f55" transform="rotate(${a} 400 360)"/>`).join("")}
    <circle cx="400" cy="275" r="62" fill="#8f5a2b"/><path d="M350 250 Q400 210 450 250" stroke="#c8a165" stroke-width="10" fill="none"/>
    <path d="M250 520 Q400 560 550 520" stroke="${p.accent}" stroke-width="14" fill="none"/>
    ${[360, 400, 440].map((x) => `<circle cx="${x}" cy="590" r="12" fill="${p.accent}"/>`).join("")}`,
  bell: (p) => `
    <rect x="388" y="170" width="24" height="90" rx="8" fill="${p.metalDark}"/>
    <circle cx="400" cy="160" r="34" fill="url(#metal)"/>
    <path d="M260 560 Q270 300 400 260 Q530 300 540 560 Z" fill="url(#metal)"/>
    <rect x="235" y="550" width="330" height="36" rx="18" fill="${p.metalDark}"/>
    <circle cx="400" cy="610" r="28" fill="${p.metalDark}"/>
    <path d="M320 380 Q400 350 480 380" stroke="#fff3c4" stroke-width="8" fill="none" opacity=".7"/>`,
  incense: (p) => `
    <ellipse cx="400" cy="600" rx="200" ry="40" fill="url(#metal)"/>
    ${[-14, 0, 14].map((a, i) => `<line x1="${380 + i * 20}" y1="590" x2="${380 + i * 20 + a * 6}" y2="300" stroke="#5c1519" stroke-width="10" stroke-linecap="round"/>
      <circle cx="${380 + i * 20 + a * 6}" cy="300" r="7" fill="${p.accent}"/>
      <path d="M${380 + i * 20 + a * 6} 290 q 30 -50 0 -100 q -30 -50 0 -100" fill="none" stroke="#b9a89e" stroke-width="6" opacity=".7"/>`).join("")}`,
  thali: (p) => `
    <ellipse cx="400" cy="480" rx="300" ry="190" fill="url(#metal)"/>
    <ellipse cx="400" cy="470" rx="250" ry="150" fill="${p.metal}" opacity=".6"/>
    <circle cx="300" cy="420" r="48" fill="#a82a30"/><circle cx="300" cy="420" r="48" fill="none" stroke="${p.metalDark}" stroke-width="8"/>
    <circle cx="500" cy="420" r="48" fill="#eccb54"/><circle cx="500" cy="420" r="48" fill="none" stroke="${p.metalDark}" stroke-width="8"/>
    <circle cx="300" cy="540" r="40" fill="#ffffff"/><circle cx="300" cy="540" r="40" fill="none" stroke="${p.metalDark}" stroke-width="8"/>
    <path d="M440 540 Q500 600 560 540 Z" fill="url(#clay)"/>${flame(500, 530, 0.8)}
    ${[0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${370 + (i % 3) * 30}" cy="${520 + Math.floor(i / 3) * 30}" r="13" fill="#f27a1a"/>`).join("")}`,
  idol: (p) => `
    <circle cx="400" cy="330" r="170" fill="url(#glow)"/>
    <circle cx="400" cy="330" r="150" fill="none" stroke="${p.metal}" stroke-width="10"/>
    <path d="M310 560 Q300 330 400 250 Q500 330 490 560 Z" fill="url(#metal)"/>
    <circle cx="400" cy="250" r="62" fill="url(#metal)"/>
    <text x="400" y="460" font-size="110" text-anchor="middle" fill="${p.accent}" font-family="serif">ॐ</text>
    ${[-70, -35, 0, 35, 70].map((a) => `<ellipse cx="400" cy="560" rx="40" ry="90" fill="${p.accent}" opacity=".85" transform="rotate(${a} 400 640)"/>`).join("")}
    <rect x="250" y="620" width="300" height="40" rx="12" fill="${p.metalDark}"/>`,
  mala: (p) => {
    const beads = Array.from({ length: 36 }, (_, i) => {
      const t = (i / 36) * Math.PI * 2;
      return `<circle cx="${400 + Math.cos(t) * 200}" cy="${360 + Math.sin(t) * 170}" r="20" fill="#7a3b1c" stroke="#4a210d" stroke-width="3"/>`;
    }).join("");
    return `${beads}<circle cx="400" cy="545" r="26" fill="${p.metal}"/>
      <path d="M385 565 L370 680 M400 565 L400 690 M415 565 L430 680" stroke="${p.accent}" stroke-width="10" stroke-linecap="round"/>`;
  },
  kumkum: (p) => `
    <ellipse cx="280" cy="540" rx="150" ry="70" fill="url(#metal)"/><ellipse cx="280" cy="510" rx="130" ry="50" fill="#a82a30"/>
    <path d="M180 505 Q280 420 380 505 Z" fill="#cc4044"/>
    <ellipse cx="530" cy="560" rx="150" ry="70" fill="url(#metal)"/><ellipse cx="530" cy="530" rx="130" ry="50" fill="#eccb54"/>
    <path d="M430 525 Q530 440 630 525 Z" fill="#f5e08c"/>
    <circle cx="420" cy="330" r="40" fill="${p.accent}" opacity=".25"/>`,
  camphor: () => `
    <ellipse cx="400" cy="560" rx="260" ry="90" fill="url(#metal)"/>
    ${[[300, 470], [400, 450], [500, 470], [350, 400], [450, 400], [400, 340]].map(([x, y]) => `<rect x="${x - 50}" y="${y - 40}" width="100" height="80" rx="18" fill="#ffffff" stroke="#e9d8b9" stroke-width="6"/>`).join("")}
    ${flame(400, 300, 0.9)}`,
  havan: (p) => `
    <path d="M200 420 L600 420 L540 520 L260 520 Z" fill="url(#metal)"/>
    <path d="M260 520 L540 520 L500 600 L300 600 Z" fill="${p.metalDark}"/>
    <rect x="180" y="400" width="440" height="30" rx="8" fill="${p.metalDark}"/>
    ${flame(330, 400, 1.3)}${flame(400, 390, 1.8)}${flame(470, 400, 1.3)}
    ${[260, 300, 500, 540].map((x) => `<rect x="${x}" y="380" width="14" height="60" fill="#8f5a2b" transform="rotate(20 ${x} 410)"/>`).join("")}`,
  samai: (p) => `
    <rect x="388" y="250" width="24" height="330" fill="url(#metal)"/>
    <ellipse cx="400" cy="600" rx="140" ry="36" fill="url(#metal)"/>
    <ellipse cx="400" cy="430" rx="150" ry="26" fill="url(#metal)"/>
    <ellipse cx="400" cy="300" rx="110" ry="22" fill="url(#metal)"/>
    ${[280, 340, 400, 460, 520].map((x) => flame(x, 420, 0.6)).join("")}
    ${[320, 400, 480].map((x) => flame(x, 290, 0.6)).join("")}
    <circle cx="400" cy="230" r="26" fill="${p.metalDark}"/>`,
  kit: (p) => `
    <rect x="200" y="380" width="400" height="260" rx="24" fill="${p.accent}"/>
    <rect x="180" y="340" width="440" height="70" rx="20" fill="${p.accent}" opacity=".85"/>
    <rect x="380" y="340" width="40" height="300" fill="${p.metal}"/>
    <path d="M400 340 Q330 260 300 320 Q340 350 400 340 Q470 260 500 320 Q460 350 400 340 Z" fill="${p.metal}"/>
    <path d="M250 330 Q320 300 300 250" stroke="#4f7f55" stroke-width="10" fill="none"/>
    ${flame(560, 330, 0.7)}`,
  garland: () => {
    const f = Array.from({ length: 19 }, (_, i) => {
      const t = Math.PI * (i / 18);
      const x = 400 - Math.cos(t) * 260, y = 260 + Math.sin(t) * 300;
      return `<circle cx="${x}" cy="${y}" r="30" fill="${i % 2 ? "#f27a1a" : "#fb923c"}"/><circle cx="${x}" cy="${y}" r="10" fill="#d9600b"/>`;
    }).join("");
    return `${f}<path d="M140 260 Q400 200 660 260" stroke="#4f7f55" stroke-width="8" fill="none"/>`;
  },
  conch: (p) => `
    <path d="M240 480 Q260 300 420 300 Q600 310 580 470 Q560 600 380 610 Q250 600 240 480 Z" fill="#fffdf8" stroke="#e9d8b9" stroke-width="10"/>
    <path d="M300 480 Q340 360 460 370 Q540 380 520 470" fill="none" stroke="#d6bd93" stroke-width="10"/>
    <path d="M560 420 L640 380 L610 450 Z" fill="#fffdf8" stroke="#e9d8b9" stroke-width="8"/>
    <path d="M300 560 Q380 520 470 560" stroke="${p.metal}" stroke-width="12" fill="none"/>`,
  dhoop: (p) => `
    <ellipse cx="400" cy="590" rx="190" ry="50" fill="url(#metal)"/>
    ${[[330, 560], [400, 545], [470, 560]].map(([x, y]) => `<path d="M${x - 35} ${y} L${x} ${y - 90} L${x + 35} ${y} Z" fill="#7a3b1c"/>
      <path d="M${x} ${y - 95} q 25 -45 0 -90 q -25 -45 0 -90" fill="none" stroke="#b9a89e" stroke-width="6" opacity=".7"/>`).join("")}
    <circle cx="400" cy="300" r="10" fill="${p.accent}" opacity=".4"/>`,
  chowki: (p) => `
    <rect x="200" y="400" width="400" height="50" rx="10" fill="#8f380f"/>
    <rect x="220" y="450" width="40" height="170" fill="#742f10"/><rect x="540" y="450" width="40" height="170" fill="#742f10"/>
    <rect x="200" y="360" width="400" height="50" rx="8" fill="${p.accent}"/>
    <path d="M200 410 L240 450 L280 410 L320 450 L360 410 L400 450 L440 410 L480 450 L520 410 L560 450 L600 410" fill="none" stroke="${p.metal}" stroke-width="8"/>
    <rect x="280" y="510" width="240" height="20" fill="#742f10"/>`,
};

const frame = (w: number, h: number, p: Palette, inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${defs(p)}<rect width="${w}" height="${h}" fill="${p.bg}"/>${inner}</svg>`;

/** Square product / category illustration. */
export function productArt(motif: Motif, palette: keyof typeof PALETTES) {
  const p = PALETTES[palette];
  return frame(800, 800, p, `
    <circle cx="400" cy="420" r="330" fill="${p.halo}" opacity=".7"/>
    <circle cx="400" cy="400" r="250" fill="url(#glow)"/>
    <ellipse cx="400" cy="690" rx="280" ry="30" fill="#000" opacity=".06"/>
    ${MOTIFS[motif](p)}`);
}

/** Wide banner: several motifs on a soft gradient, optional decorative border. */
export function bannerArt(motifs: Motif[], palette: keyof typeof PALETTES, w = 1600, h = 700) {
  const p = PALETTES[palette];
  const step = w / (motifs.length + 1);
  const scale = Math.min((h * 0.8) / 800, (w / motifs.length) / 820); // fit both height and the slot width
  const top = (h - 800 * scale) / 2;
  const items = motifs.map((m, i) => `<g transform="translate(${step * (i + 1) - 400 * scale} ${top}) scale(${scale})">${MOTIFS[m](p)}</g>`).join("");
  const dots = Array.from({ length: Math.floor(w / 40) }, (_, i) => `<circle cx="${20 + i * 40}" cy="24" r="6" fill="${p.metal}" opacity=".5"/><circle cx="${20 + i * 40}" cy="${h - 24}" r="6" fill="${p.metal}" opacity=".5"/>`).join("");
  return frame(w, h, p, `
    <linearGradient id="wide" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${p.bg}"/><stop offset="100%" stop-color="${p.halo}"/></linearGradient>
    <rect width="${w}" height="${h}" fill="url(#wide)"/>
    ${dots}
    ${motifs.map((_, i) => `<circle cx="${step * (i + 1)}" cy="${h * 0.5}" r="${h * 0.36}" fill="url(#glow)"/>`).join("")}
    ${items}`);
}
