// Performance benchmark for the PRD §9 targets:
//   public cached pages: TTFB < 200 ms (p95)    ·    uncached API list/detail: p95 < 150 ms
// Run against a production build (`next build && next start`) using the godpuja_bench data set (scripts/seed-bench.ts).
// Usage: BASE=http://localhost:3200 RUNS=60 node scripts/bench.mjs [--json out.json]
//
// TTFB = time until response headers arrive (fetch resolves then); "total" also reads the body.
// Each request carries a distinct X-Forwarded-For so per-IP rate limits do not distort the numbers.

const BASE = process.env.BASE ?? "http://localhost:3200";
const RUNS = Number(process.env.RUNS ?? 60);
const WARMUP = Number(process.env.WARMUP ?? 5);
const jsonOut = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : null;

let ipSeq = 0;
const nextIp = () => { ipSeq++; return `10.${(ipSeq >> 16) & 255}.${(ipSeq >> 8) & 255}.${ipSeq & 255}`; };

async function timed(url) {
  const t0 = performance.now();
  const res = await fetch(BASE + url, { headers: { "x-forwarded-for": nextIp(), accept: url.startsWith("/api/") ? "application/json" : "text/html" }, redirect: "manual" });
  const ttfb = performance.now() - t0;
  await res.arrayBuffer();
  return { status: res.status, ttfb, total: performance.now() - t0 };
}

const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };
const r1 = (n) => Math.round(n * 10) / 10;

/** urlFor(i) lets a case vary its URL per run (e.g. a different product each time = always a cold read). */
async function runCase({ name, kind, target, urlFor, warm = true }) {
  if (warm) for (let i = 0; i < WARMUP; i++) await timed(urlFor(-1 - i));
  const ttfb = [], total = [], statuses = new Set();
  for (let i = 0; i < RUNS; i++) {
    const r = await timed(urlFor(i));
    statuses.add(r.status); ttfb.push(r.ttfb); total.push(r.total);
  }
  const metric = kind === "page" ? ttfb : total;
  const p95 = pct(metric, 95);
  return { name, kind, url: urlFor(0), statuses: [...statuses], p50: r1(pct(metric, 50)), p95: r1(p95), max: r1(Math.max(...metric)), target, pass: p95 < target && [...statuses].every((s) => s < 400) };
}

const CAT = "/category/puja-kits";
const LEAF = "/category/puja-kits/puja-kits-sub-0";
const cases = [
  // Public pages (cached reads): TTFB target 200 ms
  { name: "home", kind: "page", target: 200, urlFor: () => "/" },
  { name: "category (top level)", kind: "page", target: 200, urlFor: () => CAT },
  { name: "category (leaf)", kind: "page", target: 200, urlFor: () => LEAF },
  { name: "category page 2", kind: "page", target: 200, urlFor: () => CAT + "?page=2" },
  { name: "product detail (warm)", kind: "page", target: 200, urlFor: () => "/product/bench-product-7" },
  { name: "CMS 404", kind: "page", target: 200, urlFor: () => "/no-such-page", expect404: true },
  { name: "sitemap.xml", kind: "page", target: 200, urlFor: () => "/sitemap.xml" },
  // Uncached API: total-time target 150 ms
  { name: "API list (newest)", kind: "api", target: 150, urlFor: (i) => `/api/products?page=${(Math.abs(i) % 20) + 1}` },
  { name: "API list (category, price asc)", kind: "api", target: 150, urlFor: (i) => `/api/products?category=puja-kits&sort=price-asc&page=${(Math.abs(i) % 5) + 1}` },
  { name: "API list (price filter, popular)", kind: "api", target: 150, urlFor: (i) => `/api/products?minPrice=20000&maxPrice=30000&sort=popular&page=${(Math.abs(i) % 3) + 1}` },
  { name: "API search", kind: "api", target: 150, urlFor: (i) => `/api/products?q=${["brass", "diya", "ganesh", "kalash", "lamp"][Math.abs(i) % 5]}` },
  // Product detail: every run asks for a different product, so each read is a cache miss.
  { name: "API detail (cold, distinct products)", kind: "api", target: 150, warm: false, urlFor: (i) => `/api/products/bench-product-${(i < 0 ? 900 : 100) + i}` },
];

// Make sure the server is up.
const probe = await fetch(BASE + "/").catch(() => null);
if (!probe) { console.error(`Server not reachable at ${BASE}`); process.exit(1); }

console.log(`Benchmark ${BASE} · ${RUNS} runs per case (+${WARMUP} warm-up) · sequential\n`);
const results = [];
for (const c of cases) {
  const r = await runCase(c);
  if (c.expect404) { r.pass = r.p95 < r.target && r.statuses.every((s) => s === 404); }
  results.push(r);
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name.padEnd(36)} ${r.kind === "page" ? "TTFB " : "total"} p50 ${String(r.p50).padStart(6)} ms  p95 ${String(r.p95).padStart(6)} ms  max ${String(r.max).padStart(6)} ms  (target p95 < ${r.target})  status ${r.statuses.join(",")}`);
}

// Concurrency smoke: 20 parallel list requests, to show the pool (maxPoolSize 10) is not a bottleneck.
{
  const t0 = performance.now();
  const rs = await Promise.all(Array.from({ length: 20 }, (_, i) => timed(`/api/products?page=${(i % 20) + 1}`)));
  const wall = performance.now() - t0;
  const p95 = pct(rs.map((r) => r.total), 95);
  console.log(`\nConcurrency: 20 parallel API list requests · wall ${r1(wall)} ms · p95 ${r1(p95)} ms · statuses ${[...new Set(rs.map((r) => r.status))].join(",")}`);
  results.push({ name: "20 parallel API list", kind: "concurrency", p95: r1(p95), wall: r1(wall) });
}

const failed = results.filter((r) => r.pass === false);
console.log(`\n${failed.length ? `${failed.length} case(s) over target` : "All cases within target"}.`);
if (jsonOut) { (await import("node:fs")).writeFileSync(jsonOut, JSON.stringify({ base: BASE, runs: RUNS, at: new Date().toISOString(), results }, null, 2)); console.log(`Wrote ${jsonOut}`); }
process.exitCode = failed.length ? 1 : 0;
