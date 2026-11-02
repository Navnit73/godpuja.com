// Real-browser audit: drives the installed Chrome through key flows, scans accessibility with axe,
// and records console errors, failed requests, horizontal overflow and screenshots.
// Usage: BASE=http://localhost:3111 OUT=/some/dir ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/browser-audit.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";

const require = createRequire(import.meta.url);
const BASE = process.env.BASE ?? "http://localhost:3111";
const OUT = process.env.OUT ?? "./audit-out";
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@godpuja.com";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "ChangeMe!12345";
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
fs.mkdirSync(OUT, { recursive: true });

const findings = [];
let suppress401Until = 0; // set when the deliberate wrong-password login returns 401
const note = (area, severity, message) => { findings.push({ area, severity, message }); console.log(`  [${severity}] ${area}: ${message}`); };
const pass = (msg) => console.log(`  ok  ${msg}`);

function watch(page, label) {
  page.on("console", (m) => { if (Date.now() < suppress401Until && m.text().includes("401")) return; if (["error", "warning"].includes(m.type())) note(label, m.type() === "error" ? "ERROR" : "warn", `console ${m.type()}: ${m.text().slice(0, 200)}`); });
  page.on("pageerror", (e) => note(label, "ERROR", `uncaught: ${String(e).slice(0, 200)}`));
  page.on("requestfailed", (r) => {
    // ERR_ABORTED = the browser cancelled the request because a newer navigation superseded it (Next prefetches,
    // or this script moving on). Real network/server failures have a different error text.
    if (r.failure()?.errorText === "net::ERR_ABORTED") return;
    note(label, "ERROR", `request failed: ${r.url()} ${r.failure()?.errorText}`);
  });
  page.on("response", (r) => {
    if (r.status() === 401 && r.url().endsWith("/api/auth/login")) suppress401Until = Date.now() + 3000;
    if (r.status() >= 500) note(label, "ERROR", `HTTP ${r.status()} ${r.url()}`);
  });
}

async function scan(page, name, { allowOverflow = false } = {}) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(axeSource);
  const res = await page.evaluate(async () => {
    const r = await axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, n: v.nodes.length, target: v.nodes[0]?.target?.join(" ") }));
  });
  for (const v of res) note(name, v.impact === "critical" || v.impact === "serious" ? "A11Y-HIGH" : "a11y", `${v.id} (${v.impact}) x${v.n}: ${v.help} @ ${v.target}`);
  if (!res.length) pass(`${name}: axe clean`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1 && !allowOverflow) note(name, "LAYOUT", `horizontal overflow by ${overflow}px`);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

// ---------- Desktop ----------
const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const d = await desk.newPage();
watch(d, "desktop");

console.log("\n# Public & login (desktop)");
await d.goto(BASE + "/");
await scan(d, "d-home");
await d.goto(BASE + "/login");
await scan(d, "d-login");
await d.getByRole("button", { name: "Sign in" }).click();
if ((await d.getByText("Enter a valid email").count())) pass("login: empty submit shows validation");
else note("login", "BUG", "no validation message on empty submit");
await d.getByLabel("Email").fill(EMAIL);
await d.getByLabel("Password").fill("wrong-password");
await d.getByRole("button", { name: "Sign in" }).click();
await d.getByRole("alert").waitFor({ timeout: 5000 }).then(() => pass("login: wrong password shows alert")).catch(() => note("login", "BUG", "no error alert for wrong password"));
await d.waitForTimeout(500);
await d.getByLabel("Password").fill(PASSWORD);
await d.getByRole("button", { name: "Sign in" }).click();
await d.waitForURL("**/admin", { timeout: 10000 }).then(() => pass("login: success redirects to /admin")).catch(() => note("login", "BUG", "did not reach /admin after valid login"));
await desk.storageState({ path: path.join(OUT, "state.json") });

await d.goto(BASE + "/nope-page-xyz");
await scan(d, "d-404");

{
  const r = await d.goto(BASE + "/nope-page-xyz");
  const h = r.headers();
  for (const [k, v] of [["x-content-type-options", "nosniff"], ["x-frame-options", "DENY"], ["referrer-policy", "strict-origin-when-cross-origin"]]) {
    if (h[k] === v) pass(`header ${k}`);
    else note("headers", "SECURITY", `${k} is ${h[k]}`);
  }
  if (h["x-powered-by"]) note("headers", "warn", "x-powered-by is exposed");
  if (await d.getByRole("link", { name: "Back to home" }).count()) pass("404: branded not-found page");
  else note("404", "BUG", "default Next 404 page is showing");
}

console.log("\n# Admin pages (desktop)");
await d.goto(BASE + "/admin");
await scan(d, "d-admin-dashboard");
await d.goto(BASE + "/admin/users");
await scan(d, "d-admin-users");
await d.goto(BASE + "/admin/pages");
await scan(d, "d-admin-pages-list");

console.log("\n# Users: modal, validation, create, edit");
await d.goto(BASE + "/admin/users");
await d.getByRole("button", { name: "Add user" }).click();
const dlg = d.getByRole("dialog");
await dlg.waitFor();
const focusInDialog = await d.evaluate(() => !!document.activeElement?.closest("dialog"));
if (focusInDialog) pass("modal: focus moved into dialog");
else note("users-modal", "A11Y-HIGH", "focus not inside dialog after open");
await scan(d, "d-users-modal");
await dlg.getByRole("button", { name: "Create user" }).click();
if ((await dlg.getByText("Enter a name").count())) pass("modal: validation errors shown");
else note("users-modal", "BUG", "no validation errors on empty submit");
await d.keyboard.press("Escape");
await dlg.waitFor({ state: "hidden", timeout: 2000 }).then(() => pass("modal: Esc closes")).catch(() => note("users-modal", "BUG", "Esc did not close the dialog"));
await d.getByRole("button", { name: "Add user" }).click();
await dlg.getByLabel("Name").fill("S4 Browser User");
await dlg.getByLabel("Email").fill("s4-browser@example.com");
await dlg.getByLabel("Role").selectOption("editor");
await dlg.getByLabel("Password").fill("longenough1");
await dlg.getByRole("button", { name: "Create user" }).click();
await d.getByText("s4-browser@example.com").waitFor({ timeout: 8000 }).then(() => pass("users: created user appears in table")).catch(() => note("users", "BUG", "created user did not appear"));
await d.getByRole("button", { name: "Edit S4 Browser User" }).click();
await dlg.getByLabel("Role").selectOption("manager");
await dlg.getByRole("button", { name: "Save changes" }).click();
await d.getByRole("row", { name: /S4 Browser User/ }).getByText("manager").waitFor({ timeout: 8000 }).then(() => pass("users: role edit saved")).catch(() => note("users", "BUG", "role edit not reflected"));
await d.getByRole("button", { name: /Edit Super Admin/ }).click();
if ((await dlg.getByLabel("Role").isDisabled())) pass("users: own role locked");
else note("users", "BUG", "own role select is editable");
await d.keyboard.press("Escape");

console.log("\n# Pages: create, edit, publish, view, reorder, preview, delete");
await d.goto(BASE + "/admin/pages/new");
await scan(d, "d-page-new");
await d.getByLabel("Title", { exact: true }).fill("S4 Browser Page");
const slugVal = await d.getByLabel("URL slug").inputValue();
if (slugVal === "s4-browser-page") pass("editor: slug auto-generated");
else note("editor", "BUG", `slug auto-generation gave "${slugVal}"`);
await d.getByRole("button", { name: "+ Rich text" }).click();
await d.getByRole("button", { name: "+ Image + text" }).click();
await d.getByLabel("Content", { exact: true }).fill("## Welcome\n\nHello **world** with a [link](https://example.com).\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n<script>window.__xss=1</script>");
await d.getByLabel("Heading", { exact: true }).fill("Feature heading");
await d.getByLabel("Text", { exact: true }).fill("Feature body text.");
await d.getByLabel("Button label").fill("Contact");
await d.getByLabel("Button link").fill("/contact");
await d.getByRole("button", { name: "Create page" }).click();
await d.waitForURL(/\/admin\/pages\/[a-f0-9]{24}$/, { timeout: 10000 }).then(() => pass("editor: create redirects to edit page")).catch(() => note("editor", "BUG", "no redirect after create"));
const editUrl = d.url();
await d.getByRole("button", { name: "Move section 1 down" }).click();
await d.getByRole("button", { name: "Save changes" }).click();
await d.getByText("Page saved").waitFor({ timeout: 8000 }).then(() => pass("editor: reorder + save")).catch(() => note("editor", "BUG", "no 'Page saved' toast"));
await d.waitForFunction(() => !document.querySelector("fieldset:disabled")); // not mid-save
await d.waitForTimeout(500); // let the 200ms enable/opacity transition finish (axe would sample mid-fade)
await scan(d, "d-page-edit");
await d.getByRole("button", { name: "Publish now" }).click();
await d.getByText("Page published").waitFor({ timeout: 8000 }).then(() => pass("editor: publish")).catch(() => note("editor", "BUG", "publish toast missing"));
await d.goto(BASE + "/s4-browser-page");
await d.getByRole("heading", { name: "S4 Browser Page", level: 1 }).waitFor({ timeout: 8000 }).then(() => pass("public: published page renders")).catch(() => note("public", "BUG", "published page did not render"));
const xssRan = await d.evaluate(() => window.__xss);
if (xssRan) note("public", "SECURITY", "injected script executed");
else pass("public: injected <script> did not execute");
const order = await d.locator("article h2").allInnerTexts();
console.log("  section order:", JSON.stringify(order));
await scan(d, "d-public-page");
await d.goto(editUrl);
const previewHref = await d.getByRole("link", { name: /Open preview/ }).getAttribute("href");
await d.goto(BASE + previewHref);
if ((await d.getByText("Preview — this page is not published").count())) pass("preview: banner shown");
else note("preview", "BUG", "no preview banner");

console.log("\n# Hindi title + validation");
await d.goto(BASE + "/admin/pages/new");
await d.getByLabel("Title", { exact: true }).fill("नमस्ते पूजा");
const hslug = await d.getByLabel("URL slug").inputValue();
console.log(`  hindi title -> slug "${hslug}" (empty is expected; user must type an English slug)`);
await d.getByRole("button", { name: "Create page" }).click();
if ((await d.getByText("Enter a URL slug").count())) pass("editor: empty slug flagged");
else note("editor", "BUG", "empty slug not flagged for Hindi title");
await d.getByLabel("URL slug").fill("admin");
await d.getByRole("button", { name: "Create page" }).click();
if ((await d.getByText(/reserved/).count())) pass("editor: reserved slug flagged");
else note("editor", "BUG", "reserved slug not flagged");

console.log("\n# CMS homepage");
await d.getByLabel("Title", { exact: true }).fill("S4 Home");
await d.getByLabel("URL slug").fill("home");
await d.getByRole("button", { name: "+ Rich text" }).click();
await d.getByLabel("Content", { exact: true }).fill("## Home content from CMS");
await d.getByRole("button", { name: "Create page" }).click();
await d.waitForURL(/\/admin\/pages\/[a-f0-9]{24}$/, { timeout: 10000 });
await d.getByRole("button", { name: "Publish now" }).click();
await d.getByText("Page published").waitFor({ timeout: 8000 });
await d.goto(BASE + "/");
if ((await d.getByText("Home content from CMS").count())) pass("home: CMS 'home' page renders at /");
else note("home", "BUG", "CMS home page not shown at /");
await d.goto(BASE + "/home");
if (new URL(d.url()).pathname === "/") pass("home: /home redirects to /");
else note("home", "BUG", `/home ended at ${d.url()}`);
const canon = await d.locator('link[rel="canonical"]').getAttribute("href");
if (canon && new URL(canon).pathname === "/") pass(`home: canonical is ${canon}`);
else note("home", "BUG", `canonical is ${canon}`);
await scan(d, "d-home-cms");

console.log("\n# Delete confirmation");
await d.goto(editUrl);
await d.getByRole("button", { name: "Delete page" }).click();
await d.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
await d.waitForURL("**/admin/pages", { timeout: 8000 }).then(() => pass("editor: delete returns to list")).catch(() => note("editor", "BUG", "delete did not return to list"));

// ---------- Mobile ----------
console.log("\n# Mobile (390x844)");
const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: path.join(OUT, "state.json"), hasTouch: true, isMobile: true });
const m = await mob.newPage();
watch(m, "mobile");
await m.goto(BASE + "/login"); // logged-in state, still public
await scan(m, "m-login");
await m.goto(BASE + "/admin");
await scan(m, "m-admin-dashboard");
const tabbableClosed = await m.evaluate(() => {
  const s = document.getElementById("admin-sidebar");
  const style = getComputedStyle(s);
  return { visibility: style.visibility, links: s.querySelectorAll("a").length };
});
if (tabbableClosed.visibility === "hidden") pass("mobile: closed drawer is visibility:hidden (not tabbable)");
else note("mobile-drawer", "A11Y-HIGH", `closed drawer visibility=${tabbableClosed.visibility}`);
await m.getByRole("button", { name: "Open navigation" }).click();
await m.waitForTimeout(400);
const focusLink = await m.evaluate(() => document.activeElement?.textContent);
if (focusLink?.includes("Dashboard")) pass("mobile: focus moved to first drawer link");
else note("mobile-drawer", "A11Y", `focus on "${focusLink}" after open`);
await m.screenshot({ path: path.join(OUT, "m-drawer-open.png") });
await m.keyboard.press("Escape");
await m.waitForTimeout(400);
const backOn = await m.evaluate(() => document.activeElement?.getAttribute("aria-label"));
if (backOn === "Open navigation") pass("mobile: Esc closes drawer, focus returns to menu button");
else note("mobile-drawer", "A11Y", `focus after Esc: ${backOn}`);
await m.goto(BASE + "/admin/users");
await scan(m, "m-admin-users", { allowOverflow: true });
const tableScrolls = await m.evaluate(() => { const c = document.querySelector(".card.overflow-x-auto"); return c ? c.scrollWidth > c.clientWidth : null; });
console.log(`  users table scrolls inside its card on mobile: ${tableScrolls}`);
await m.goto(BASE + "/admin/pages/new");
await scan(m, "m-page-new");
const btnHeights = await m.evaluate(() => [...document.querySelectorAll("button, a.btn-outline, a.btn-primary")].map((b) => ({ t: b.textContent.trim().slice(0, 20), h: Math.round(b.getBoundingClientRect().height) })).filter((b) => b.h && b.h < 40));
if (btnHeights.length) note("mobile", "a11y", `touch targets under 40px: ${JSON.stringify(btnHeights.slice(0, 6))}`);
else pass("mobile: touch targets >= 40px");

// ---------- Customer (no admin access) ----------
console.log("\n# Customer login");
const custEmail = "s4-customer@example.com";
const created = await desk.request.post(BASE + "/api/admin/users", { data: { name: "S4 Customer", email: custEmail, password: "longenough1", role: "customer" } });
if (created.status() !== 201) note("customer", "BUG", `could not create customer via admin API: ${created.status()}`);
const cust = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const c = await cust.newPage();
watch(c, "customer");
await c.goto(BASE + "/login?next=/admin");
await c.getByLabel("Email").fill(custEmail);
await c.getByLabel("Password").fill("longenough1");
await c.getByRole("button", { name: "Sign in" }).click();
await c.waitForURL((u) => u.pathname === "/", { timeout: 8000 }).then(() => pass("customer: login lands on storefront (no /login loop)")).catch(() => note("customer", "BUG", `customer login ended at ${c.url()}`));
await c.goto(BASE + "/admin");
if (new URL(c.url()).pathname === "/login") pass("customer: /admin is blocked");
else note("customer", "SECURITY", `customer reached ${c.url()}`);
await c.goto(BASE + "/login");
await c.waitForURL((u) => u.pathname === "/", { timeout: 5000 }).catch(() => {}); // redirect streams in after first paint
if (new URL(c.url()).pathname === "/") pass("customer: signed-in user is redirected away from /login");
else note("customer", "BUG", `/login stayed for signed-in customer: ${c.url()}`);
const reg = await c.request.post(BASE + "/api/auth/register", { data: { name: "X Y", email: "s4-reg@example.com", password: "longenough1" } });
if (reg.status() === 403) pass("register: closed by default (403)");
else note("register", "SECURITY", `register returned ${reg.status()}`);
const unk = await c.request.get(BASE + "/api/does-not-exist");
if (unk.status() === 404 && (await unk.json()).error?.code === "NOT_FOUND") pass("api: unknown path returns JSON 404");
else note("api", "BUG", `unknown API path returned ${unk.status()}`);
await cust.close();

// ---------- Sign out ----------
console.log("\n# Sign out");
await d.goto(BASE + "/admin");
await d.getByRole("button", { name: "Sign out" }).click();
await d.waitForURL("**/login", { timeout: 8000 }).then(() => pass("signout: redirects to /login")).catch(() => note("signout", "BUG", "no redirect after sign out"));
await d.goto(BASE + "/admin");
if (new URL(d.url()).pathname === "/login") pass("signout: /admin now requires login");
else note("signout", "SECURITY", "admin still reachable after sign out");

await browser.close();
fs.writeFileSync(path.join(OUT, "findings.json"), JSON.stringify(findings, null, 2));
const bad = findings.filter((f) => !["warn", "a11y"].includes(f.severity));
console.log(`\nDone. ${findings.length} findings (${bad.length} errors/bugs/high). Screenshots + findings.json in ${OUT}`);
