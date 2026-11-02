// Accessibility + CSP sweep across every storefront and admin page, desktop and mobile.
// For each page: axe (WCAG 2.1 A/AA + best practice), CSP violations, console errors, horizontal overflow, and a
// keyboard check (first Tab lands on the skip link or a visible focusable element with a focus indicator).
// Also walks the shopping flow: product -> add to cart -> cart -> checkout form (validation errors announced).
// Usage: BASE=http://localhost:3200 OUT=./a11y-out ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/a11y-audit.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";

const require = createRequire(import.meta.url);
const BASE = process.env.BASE ?? "http://localhost:3200";
const OUT = process.env.OUT ?? "./a11y-out";
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@godpuja.com";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "ChangeMe!12345";
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PRODUCT = process.env.PRODUCT ?? "/product/bench-product-7";
const CATEGORY = process.env.CATEGORY ?? "/category/puja-kits";
const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
fs.mkdirSync(OUT, { recursive: true });

const findings = [];
const note = (page, severity, message) => { findings.push({ page, severity, message }); console.log(`  [${severity}] ${page}: ${message}`); };

function watch(p, label) {
  p.on("console", (m) => {
    const t = m.text();
    if (/Content Security Policy|Refused to/i.test(t)) note(label(), "CSP", t.slice(0, 220));
    // 400/401/403/404 are expected here (deliberate empty checkout submit = server validation, the 404 page).
    else if (m.type() === "error" && !/status of 40[0134]/.test(t)) note(label(), "CONSOLE", t.slice(0, 200));
  });
  p.on("pageerror", (e) => note(label(), "ERROR", String(e).slice(0, 200)));
}

async function scan(p, name, { allowOverflow = false } = {}) {
  await p.waitForLoadState("networkidle").catch(() => {});
  await p.waitForTimeout(300); // let CSS transitions settle so axe does not sample mid-fade
  await p.evaluate(axeSource);
  const res = await p.evaluate(async () => {
    const r = await axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, target: v.nodes[0]?.target?.join(" "), help: v.help }));
  });
  for (const v of res) note(name, ["critical", "serious"].includes(v.impact) ? "A11Y-HIGH" : "a11y", `${v.id} (${v.impact}) x${v.n}: ${v.help} @ ${v.target}`);
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1 && !allowOverflow) note(name, "LAYOUT", `horizontal overflow by ${overflow}px`);
  // Keyboard: first Tab must land on something visible that shows focus.
  await p.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  await p.keyboard.press("Tab");
  const focus = await p.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { ok: false, what: "nothing" };
    const cs = getComputedStyle(el);
    const ring = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0 || cs.boxShadow !== "none";
    const r = el.getBoundingClientRect();
    return { ok: ring && r.width > 0 && r.height > 0, what: `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}"`, ring };
  });
  if (!focus.ok) note(name, "A11Y-HIGH", `first Tab: ${focus.what} (focus ring: ${focus.ring})`);
  console.log(`  ${res.length ? "--" : "ok"}  ${name}${res.length ? ` (${res.length} axe rule(s))` : ""} · first Tab -> ${focus.what}`);
  await p.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const storefront = ["/", CATEGORY, CATEGORY + "?sort=price-asc&page=2", PRODUCT, "/search", "/search?q=brass", "/search?q=zzzznothing", "/cart", "/checkout", "/no-such-page", "/login"];

for (const [label, vp] of [["d", { viewport: { width: 1280, height: 800 } }], ["m", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
  console.log(`\n# Storefront (${label === "d" ? "desktop" : "mobile"})`);
  const ctx = await browser.newContext(vp);
  const p = await ctx.newPage();
  let current = "";
  watch(p, () => current);
  for (const url of storefront) {
    current = `${label} ${url}`;
    await p.goto(BASE + url);
    await scan(p, `${label}-${url.replace(/[^a-z0-9]+/gi, "_") || "home"}`);
  }

  console.log(`\n# Shopping flow (${label})`);
  current = `${label} flow`;
  await p.goto(BASE + PRODUCT);
  await p.getByRole("button", { name: "Add to cart" }).click();
  await p.goto(BASE + "/cart");
  await p.getByRole("heading", { level: 1 }).waitFor();
  await scan(p, `${label}-cart-filled`);
  await p.goto(BASE + "/checkout");
  await p.waitForLoadState("networkidle");
  const submit = p.getByRole("button", { name: /place order/i });
  if (await submit.count()) {
    await submit.click();
    await p.waitForTimeout(400);
    const invalid = await p.locator('[aria-invalid="true"]').count();
    const described = await p.locator('[aria-invalid="true"][aria-describedby]').count();
    if (!invalid) note(`${label} checkout`, "BUG", "empty submit marked no field invalid");
    else if (described < invalid) note(`${label} checkout`, "A11Y-HIGH", `${invalid - described} invalid field(s) without aria-describedby error text`);
    else console.log(`  ok  checkout: ${invalid} invalid fields, all linked to error text`);
    const focusedInvalid = await p.evaluate(() => document.activeElement?.getAttribute("aria-invalid") === "true");
    if (!focusedInvalid) note(`${label} checkout`, "a11y", "focus did not move to the first invalid field");
    await scan(p, `${label}-checkout-errors`);
  } else note(`${label} checkout`, "BUG", "no Place order button (cart empty?)");
  await ctx.close();
}

console.log("\n# Admin (desktop + mobile)");
const admin = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const a = await admin.newPage();
let cur = "";
watch(a, () => cur);
await a.goto(BASE + "/login");
await a.getByLabel("Email").fill(EMAIL);
await a.getByLabel("Password").fill(PASSWORD);
await a.getByRole("button", { name: "Sign in" }).click();
await a.waitForURL("**/admin", { timeout: 15000 });
const state = path.join(OUT, "admin-state.json");
await admin.storageState({ path: state });

const firstLink = async (listUrl, re) => {
  await a.goto(BASE + listUrl);
  const href = await a.locator("main a[href]").evaluateAll((els, src) => els.map((e) => e.getAttribute("href")).find((h) => new RegExp(src).test(h ?? "")), re.source);
  return href ?? null;
};
const adminPages = ["/admin", "/admin/users", "/admin/pages", "/admin/pages/new", "/admin/navigation", "/admin/footer", "/admin/homepage",
  "/admin/categories", "/admin/categories/new", "/admin/products", "/admin/products/new", "/admin/inventory", "/admin/media", "/admin/orders", "/admin/seo"];
for (const [list, re] of [["/admin/products", /^\/admin\/products\/[a-f0-9]{24}$/], ["/admin/categories", /^\/admin\/categories\/[a-f0-9]{24}$/], ["/admin/navigation", /^\/admin\/navigation\/[a-f0-9]{24}$/], ["/admin/orders", /^\/admin\/orders\/[a-f0-9]{24}$/]]) {
  const h = await firstLink(list, re);
  if (h) adminPages.push(h);
}
for (const url of adminPages) {
  cur = `admin ${url}`;
  await a.goto(BASE + url);
  await scan(a, `d-admin${url.replace(/\/admin/, "").replace(/[^a-z0-9]+/gi, "_") || "_dashboard"}`, { allowOverflow: false });
}
const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, storageState: state });
const m = await mob.newPage();
watch(m, () => cur);
for (const url of ["/admin", "/admin/products", "/admin/products/new", "/admin/orders", "/admin/homepage", "/admin/seo"]) {
  cur = `m admin ${url}`;
  await m.goto(BASE + url);
  await scan(m, `m-admin${url.replace(/\/admin/, "").replace(/[^a-z0-9]+/gi, "_") || "_dashboard"}`, { allowOverflow: true }); // wide tables scroll inside their card
}

await browser.close();
fs.writeFileSync(path.join(OUT, "findings.json"), JSON.stringify(findings, null, 2));
const bySev = findings.reduce((acc, f) => ({ ...acc, [f.severity]: (acc[f.severity] ?? 0) + 1 }), {});
console.log(`\nDone. ${findings.length} findings ${JSON.stringify(bySev)}. Screenshots + findings.json in ${OUT}`);
process.exitCode = findings.some((f) => ["A11Y-HIGH", "CSP", "ERROR", "BUG"].includes(f.severity)) ? 1 : 0;
