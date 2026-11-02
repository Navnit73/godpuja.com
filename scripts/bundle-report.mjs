// Client JavaScript actually shipped per page: fetches each page's HTML from a running production server, collects
// every /_next/static script it references, and sums raw + gzip sizes. Also flags admin-only code on storefront pages.
// Usage: BASE=http://localhost:3200 node scripts/bundle-report.mjs [--cookie "<session cookie>"]
import { gzipSync } from "node:zlib";

const BASE = process.env.BASE ?? "http://localhost:3200";
const COOKIE = process.argv.includes("--cookie") ? process.argv[process.argv.indexOf("--cookie") + 1] : "";
const pages = (process.env.PAGES ?? "/,/category/puja-kits,/product/bench-product-7,/search?q=brass,/cart,/checkout,/login").split(",");
const ADMIN_MARKERS = ["@dnd-kit", "react-hook-form", "ImagePicker", "SectionEditor", "/admin/"];
const cache = new Map();

async function asset(src) {
  if (!cache.has(src)) {
    const buf = Buffer.from(await (await fetch(new URL(src, BASE))).arrayBuffer());
    cache.set(src, { raw: buf.length, gz: gzipSync(buf).length, text: buf.toString("utf8") });
  }
  return cache.get(src);
}

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
console.log(`Client JS per page (${BASE})\n`);
const rows = [];
for (const p of pages) {
  const html = await (await fetch(BASE + p, { headers: COOKIE ? { cookie: COOKIE } : {} })).text();
  // Legacy polyfills are <script noModule>: modern browsers never download them, so they are not counted.
  const legacy = new Set([...html.matchAll(/<script[^>]*src="([^"]+\.js)"[^>]*noModule/gi)].map((m) => m[1]));
  const srcs = [...new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]))].filter((s) => !legacy.has(s));
  let raw = 0, gz = 0;
  const markers = new Set();
  for (const s of srcs) {
    const a = await asset(s);
    raw += a.raw; gz += a.gz;
    for (const m of ADMIN_MARKERS) if (!p.startsWith("/admin") && a.text.includes(m)) markers.add(m);
  }
  rows.push({ page: p, scripts: srcs.length, raw, gz, adminCode: [...markers] });
  console.log(`${p.padEnd(32)} ${String(srcs.length).padStart(3)} scripts  ${kb(raw).padStart(9)} raw  ${kb(gz).padStart(8)} gzip${markers.size ? `  ADMIN CODE: ${[...markers].join(", ")}` : ""}`);
}
if (process.argv.includes("--json")) console.log(JSON.stringify(rows));
