// Phase 1 end-to-end run in real Chrome against a server using the TEST database seeded by scripts/e2e-seed.ts.
//   npx tsx scripts/e2e-seed.ts
//   MONGODB_URI=<…/godpuja_test> npx next dev -p 3117        (or `next start` once the build works)
//   BASE=http://localhost:3117 node scripts/e2e-phase1.mjs
import fs from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";

const require = createRequire(import.meta.url);
const BASE = process.env.BASE ?? "http://localhost:3117";
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
let failures = 0, checks = 0;
const check = (ok, msg) => { checks++; if (!ok) failures++; console.log(`  ${ok ? "ok  " : "FAIL"} ${msg}`); };

async function axe(page, name) {
  await page.evaluate(axeSource);
  const v = await page.evaluate(async () => (await axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] })).violations.map((x) => `${x.id}@${x.nodes[0]?.target?.join(" ")}`));
  check(v.length === 0, `${name}: axe clean${v.length ? ` — ${v.join("; ")}` : ""}`);
}
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  // ---- first visit: consent banner, nothing sent to Google until accepted
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  // `next dev` draws a clickable overlay over the page corner; hide it so clicks reach the app (no effect on a production build).
  await ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.head.append(st); }));
  const gaRequests = [];
  await ctx.route(/googletagmanager\.com|google-analytics\.com/, (r) => { gaRequests.push(r.request().url()); r.abort(); });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE, { waitUntil: "networkidle" });
  console.log("Homepage and consent");
  const banner = page.getByRole("dialog", { name: "Cookies" });
  check(await banner.isVisible(), "cookie banner shown on first visit");
  check(gaRequests.length === 0, "no Google request before a choice");
  const tiles = page.getByRole("list", { name: "Explore GodPuja" }).getByRole("link");
  check((await tiles.count()) === 6, "six quick-access tiles");
  check((await page.getByText("Coming soon").count()) === 3, "three tiles marked Coming soon (Temples, Book a Pooja, Donate)");
  check(await page.getByRole("heading", { name: "Pooja Vidhi" }).first().isVisible(), "Pooja Vidhi highlights shown");
  check(await page.getByRole("link", { name: /Ganesh Aarti/ }).first().isVisible(), "Aarti highlight shown");
  check((await overflow(page)) <= 1, "homepage fits 390 px");
  await axe(page, "homepage with banner");

  await banner.getByRole("button", { name: "Reject analytics" }).click();
  await page.waitForTimeout(800);
  check(!(await banner.isVisible()), "banner closes after Reject");
  check(gaRequests.length === 0, "still no Google request after Reject");
  await page.reload({ waitUntil: "networkidle" });
  check(!(await page.getByRole("dialog", { name: "Cookies" }).isVisible()) && gaRequests.length === 0, "choice remembered; still nothing sent");

  await page.getByRole("button", { name: "Cookie settings" }).click();
  check(await page.getByRole("dialog", { name: "Cookies" }).isVisible(), "footer 'Cookie settings' reopens the banner");
  await page.getByRole("button", { name: "Accept analytics" }).click();
  await page.waitForTimeout(1500);
  check(gaRequests.some((u) => u.includes("googletagmanager.com/gtag/js?id=G-E2ETEST123")), "gtag requested only after Accept, with the configured ID");

  // ---- coming soon
  console.log("Coming-soon pillars");
  for (const p of ["/temples", "/book-a-pooja", "/donate"]) {
    const r = await page.goto(BASE + p, { waitUntil: "networkidle" });
    check(r.status() === 200 && (await page.getByText("Coming soon").first().isVisible()), `${p}: 200 with a coming-soon message`);
    check((await page.locator('meta[name="robots"]').getAttribute("content"))?.includes("noindex"), `${p}: noindex`);
  }
  await axe(page, "coming-soon page");

  // ---- aarti
  console.log("Aarti and audio rights");
  await page.goto(BASE + "/aarti", { waitUntil: "networkidle" });
  check((await page.getByRole("link", { name: /Ganesh Aarti/ }).count()) > 0 && (await page.getByRole("link", { name: /Lakshmi Aarti/ }).count()) > 0, "index lists both aarti");
  check((await page.getByText("Audio", { exact: true }).count()) === 1, "Audio badge only on the aarti whose rights are valid");
  await page.getByLabel("Search", { exact: true }).fill("lakshmi");
  await page.getByRole("button", { name: "Search" }).click();
  await page.waitForLoadState("networkidle");
  check((await page.getByRole("link", { name: /Lakshmi Aarti/ }).count()) > 0 && (await page.getByRole("link", { name: /Ganesh Aarti/ }).count()) === 0, "search narrows the list");
  check((await page.locator('meta[name="robots"]').getAttribute("content"))?.includes("noindex") ?? false, "a searched list is noindex");
  await axe(page, "aarti index");

  await page.goto(BASE + "/aarti/ganesh-aarti", { waitUntil: "networkidle" });
  const player = page.getByRole("region", { name: /Audio: Ganesh Aarti/ });
  check(await player.isVisible(), "licensed aarti shows the audio player");
  check(await player.getByRole("button", { name: /Play/ }).isVisible() && await player.getByRole("slider", { name: "Seek" }).count() === 1 && await player.getByLabel("Volume").count() === 1 && await player.getByLabel("Speed").count() === 1, "player has play, seek, volume and speed");
  check(await page.getByText("Recording: Recorded for GodPuja").isVisible(), "credit line shown");
  check(await page.locator('[lang="hi"]').filter({ hasText: "जय गणेश" }).count() > 0, "lyrics marked lang=hi");
  const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(" ");
  check(ld.includes("AudioObject") && ld.includes("Article"), "Article + AudioObject structured data");
  await player.getByLabel("Speed").selectOption("1.5");
  check((await player.getByLabel("Speed").inputValue()) === "1.5", "speed can be changed");
  check((await overflow(page)) <= 1, "aarti page fits 390 px");
  await axe(page, "aarti detail with player");

  await page.goto(BASE + "/aarti/lakshmi-aarti", { waitUntil: "networkidle" });
  check((await page.getByRole("region", { name: /Audio:/ }).count()) === 0, "withdrawn recording: no player");
  check(await page.getByText("ॐ जय लक्ष्मी माता").isVisible(), "…but the lyrics stay");
  check(!(await page.locator('script[type="application/ld+json"]').allTextContents()).join(" ").includes("AudioObject"), "…and no AudioObject structured data");

  // ---- mantras, vidhi, 404s
  console.log("Mantras, Pooja Vidhi, real 404s");
  check((await page.goto(BASE + "/mantras/gayatri-mantra")).status() === 200, "/mantras/gayatri-mantra 200");
  check((await page.goto(BASE + "/aarti/gayatri-mantra")).status() === 404, "a mantra under /aarti is a real 404");
  check((await page.goto(BASE + "/aarti/nope")).status() === 404, "unknown aarti is a real 404");
  await page.goto(BASE + "/pooja-vidhi/daily-ganesh-pooja", { waitUntil: "networkidle" });
  check(await page.getByRole("heading", { name: "Aarti and mantras for this pooja" }).isVisible(), "guide shows its related aarti");
  await axe(page, "pooja vidhi with related aarti");
  const sm = await (await page.request.get(BASE + "/sitemap.xml")).text();
  check(["/aarti/ganesh-aarti", "/mantras/gayatri-mantra", "/pooja-vidhi/daily-ganesh-pooja"].every((p) => sm.includes(p)), "sitemap lists the new pages");
  check(!sm.includes("/temples"), "sitemap omits coming-soon pages");
  check(errors.length === 0, `no uncaught page errors${errors.length ? `: ${errors[0].slice(0, 120)}` : ""}`);
  await ctx.close();
} finally { await browser.close(); }
console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
