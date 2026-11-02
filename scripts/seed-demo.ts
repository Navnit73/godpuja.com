// Demo data for the MAIN database: clears all content and seeds a realistic puja-samagri store.
//   - Keeps the `users` collection (your admin login keeps working). Everything else is emptied.
//   - All content goes through the app's own zod schemas and services, exactly as if typed into the admin.
//   - Images are original SVG illustrations written to public/demo/ and referenced via SITE_URL.
// Usage: npx tsx scripts/seed-demo.ts --yes        (refuses to run without --yes)
// Afterwards restart `next dev` (or wait ~5 min) so cached pages pick up the new content.
import { config } from "dotenv";
const targetDb = process.env.SEED_DB; // optional: seed a different database (e.g. a dry run on godpuja_bench)
config({ path: ".env.local", override: true, quiet: true });
if (targetDb) {
  const u = new URL(process.env.MONGODB_URI ?? "");
  u.pathname = `/${targetDb}`;
  process.env.MONGODB_URI = u.toString();
}

import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { connectDB } from "../src/server/db";
import { env } from "../src/server/env";
import { Product } from "../src/server/models/Product";
import { createCategory } from "../src/server/services/categories";
import { createProduct } from "../src/server/services/products";
import { createPage, setPublishState } from "../src/server/services/pages";
import { createMenu, updateMenu } from "../src/server/services/menus";
import { updateFooter } from "../src/server/services/footer";
import { updateHomepage } from "../src/server/services/homepage";
import { updateSeoSettings } from "../src/server/services/settings";
import { categoryInputSchema, productInputSchema } from "../src/lib/validation/catalog";
import { pageInputSchema } from "../src/lib/validation/pages";
import { updateMenuSchema, type MenuItemInput } from "../src/lib/validation/menus";
import { updateFooterSchema } from "../src/lib/validation/footer";
import { updateHomepageSchema } from "../src/lib/validation/homepage";
import { updateSeoSettingsSchema } from "../src/lib/validation/seo";
import { bannerArt, productArt, type Motif, type PALETTES } from "./demo/art";
import { CATEGORIES, PRODUCTS } from "./demo/catalog";
import { PAGES } from "./demo/pages";

const KEEP = new Set(["users"]);
const rupees = (n: number) => Math.round(n * 100);
const noSeo = { title: "", description: "", canonical: "", ogImage: "", noindex: false };

// ---------- images ----------
const DEMO_DIR = path.resolve("public/demo");
const SITE = env().SITE_URL.replace(/\/$/, "");
const url = (file: string) => `${SITE}/demo/${file}`;
function writeArt(file: string, svg: string) {
  fs.writeFileSync(path.join(DEMO_DIR, file), svg);
  return url(file);
}
const square = (name: string, motif: Motif, palette: keyof typeof PALETTES) => writeArt(`${name}.svg`, productArt(motif, palette));

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error("This clears every collection except `users` in the database from .env.local. Re-run with --yes.");
    process.exit(1);
  }
  await connectDB();
  const db = mongoose.connection.db!;
  console.log(`Database: ${db.databaseName}  ·  image base: ${SITE}/demo/`);

  // 1. Clear (deleteMany keeps indexes).
  const cols = (await db.listCollections().toArray()).map((c) => c.name).filter((n) => !KEEP.has(n) && !n.startsWith("system."));
  for (const c of cols) {
    const r = await db.collection(c).deleteMany({});
    console.log(`  cleared ${c} (${r.deletedCount})`);
  }

  fs.rmSync(DEMO_DIR, { recursive: true, force: true });
  fs.mkdirSync(DEMO_DIR, { recursive: true });

  // 2. Categories.
  const catId = new Map<string, string>();
  for (const [i, c] of CATEGORIES.entries()) {
    const top = await createCategory(categoryInputSchema.parse({
      name: c.name, slug: c.slug, parent: null, description: c.description, order: i, isActive: true, seo: noSeo,
      image: { url: square(`cat-${c.slug}`, c.motif, c.palette), alt: `${c.name} illustration` },
    }));
    catId.set(c.slug, top.id);
    for (const [j, s] of c.children.entries()) {
      const child = await createCategory(categoryInputSchema.parse({
        name: s.name, slug: s.slug, parent: top.id, description: s.description, order: j, isActive: true, seo: noSeo,
        image: { url: square(`cat-${c.slug}-${s.slug}`, s.motif, s.palette), alt: `${s.name} illustration` },
      }));
      catId.set(`${c.slug}/${s.slug}`, child.id);
    }
  }
  console.log(`  categories: ${catId.size}`);

  // 3. Products (created oldest-first so "New arrivals" shows the end of the list first).
  const productId = new Map<string, string>();
  for (const [i, p] of PRODUCTS.entries()) {
    const palettes: (keyof typeof PALETTES)[] = [p.palette, "sandal", "gold"];
    const images = palettes.slice(0, 2).map((pal, k) => ({
      url: square(`p-${p.slug}-${k + 1}`, p.motif, pal),
      alt: k === 0 ? `${p.name} — illustration` : `${p.name} — alternate view`,
    }));
    const description = [
      p.short, "", "## Highlights", ...p.highlights.map((h) => `- ${h}`),
      ...(p.contents ? ["", "## What's in the box", ...p.contents.map((c) => `- ${c}`)] : []),
      "", "## Care", p.care ?? "Store in a cool, dry place away from direct sunlight. Keep away from children when lit.",
      "", "_Images are illustrations; the product may vary slightly as each piece is handmade._",
    ].join("\n");
    const hasVariants = !!p.variants?.length;
    const created = await createProduct(productInputSchema.parse({
      name: p.name, slug: p.slug, sku: `GP-${String(i + 1).padStart(3, "0")}`, shortDescription: p.short, description,
      images, category: catId.get(p.category) ?? null, brand: p.brand,
      price: rupees(p.price), salePrice: p.salePrice ? rupees(p.salePrice) : null,
      stock: hasVariants ? 0 : p.stock, lowStockThreshold: 5, status: "active", isFeatured: !!p.featured,
      attributes: p.attributes.map(([name, value]) => ({ name, value })),
      variants: (p.variants ?? []).map((v) => ({ sku: v.sku, options: v.options, price: v.price ? rupees(v.price) : null, salePrice: v.salePrice ? rupees(v.salePrice) : null, stock: v.stock })),
      shipping: { weightGrams: p.weight, length: 0, width: 0, height: 0, freeShipping: p.price >= 999 },
      seo: noSeo,
    }));
    productId.set(p.slug, created.id);
    // Sales history drives "Best sellers"; spread creation dates so "New arrivals" has a natural order.
    await Product.updateOne({ _id: created.id }, { $set: { soldCount: p.sold, createdAt: new Date(Date.now() - (PRODUCTS.length - i) * 36e5 * 7) } }, { timestamps: false });
  }
  console.log(`  products: ${productId.size}`);

  // 4. CMS pages (published).
  const pageId = new Map<string, string>();
  for (const pg of PAGES) {
    const created = await createPage(pageInputSchema.parse({
      title: pg.title, slug: pg.slug, description: pg.description, seo: noSeo,
      sections: pg.sections.map((s, k) => s.type === "richtext"
        ? { id: `s${k + 1}`, type: "richtext", enabled: true, data: { markdown: s.markdown } }
        : { id: `s${k + 1}`, type: "imageText", enabled: true, data: { heading: s.heading, markdown: s.markdown, imageUrl: square(`page-${pg.slug}-${k + 1}`, s.motif, s.palette), imageAlt: s.imageAlt, imagePosition: s.imagePosition, ctaLabel: s.ctaLabel ?? "", ctaUrl: s.ctaUrl ?? "" } }),
    }));
    await setPublishState(created.id, { action: "publish" });
    pageId.set(pg.slug, created.id);
  }
  console.log(`  pages: ${pageId.size} (published)`);

  // 5. Navigation.
  let n = 0;
  const link = (label: string, url: string, children: MenuItemInput[] = [], opts: Partial<MenuItemInput> = {}): MenuItemInput =>
    ({ id: `m${++n}`, label, type: "external", url, openInNewTab: false, enabled: true, showOnDesktop: true, showOnMobile: true, children, ...opts });
  const pageLink = (label: string, slug: string, opts: Partial<MenuItemInput> = {}): MenuItemInput =>
    ({ id: `m${++n}`, label, type: "page", ref: pageId.get(slug)!, openInNewTab: false, enabled: true, showOnDesktop: true, showOnMobile: true, children: [], ...opts });
  const catMenu = () => CATEGORIES.map((c) => link(c.name, `/category/${c.slug}`, c.children.map((s) => link(s.name, `/category/${c.slug}/${s.slug}`))));

  const header = [...catMenu().slice(0, 5), pageLink("About", "about-us")];
  const mobile = [link("Home", "/"), ...catMenu(), pageLink("About us", "about-us"), pageLink("FAQs", "faq"), pageLink("Contact us", "contact-us")];
  for (const [key, name, items] of [["header", "Header navigation", header], ["mobile", "Mobile navigation", mobile]] as const) {
    const m = await createMenu({ key, name });
    await updateMenu(m.id, updateMenuSchema.parse({ name, items, baseUpdatedAt: m.updatedAt }));
  }
  console.log("  menus: header, mobile");

  // 6. Footer.
  let f = 0;
  const fl = (label: string, url: string) => ({ id: `f${++f}`, label, type: "external" as const, url, openInNewTab: false, enabled: true });
  const fp = (label: string, slug: string) => ({ id: `f${++f}`, label, type: "page" as const, ref: pageId.get(slug)!, openInNewTab: false, enabled: true });
  await updateFooter(updateFooterSchema.parse({
    baseUpdatedAt: null,
    columns: [
      { id: "c-shop", heading: "Shop", enabled: true, links: CATEGORIES.map((c) => fl(c.name, `/category/${c.slug}`)) },
      { id: "c-festivals", heading: "Festival kits", enabled: true, links: [fl("Diwali puja kit", "/product/diwali-lakshmi-puja-kit"), fl("Navratri puja kit", "/product/navratri-durga-puja-kit"), fl("Ganesh Chaturthi kit", "/product/ganesh-chaturthi-sthapana-kit"), fl("Satyanarayan katha kit", "/product/satyanarayan-katha-kit")] },
      { id: "c-help", heading: "Help", enabled: true, links: [fp("FAQs", "faq"), fp("Shipping & delivery", "shipping-policy"), fp("Returns & refunds", "returns-refunds"), fp("Contact us", "contact-us")] },
      { id: "c-company", heading: "GodPuja", enabled: true, links: [fp("About us", "about-us"), fl("Search products", "/search")] },
    ],
    social: [
      { id: "s-ig", platform: "instagram", url: "https://www.instagram.com/godpuja", enabled: true },
      { id: "s-fb", platform: "facebook", url: "https://www.facebook.com/godpuja", enabled: true },
      { id: "s-yt", platform: "youtube", url: "https://www.youtube.com/@godpuja", enabled: true },
    ],
    contact: { address: "Varanasi, Uttar Pradesh, India", phone: "", email: "support@godpuja.com" },
    newsletter: { enabled: true, heading: "Festival reminders & offers", text: "Get puja dates, vidhi guides and early access to festival sales. No spam — unsubscribe anytime." },
    legalLinks: [fp("Privacy policy", "privacy-policy"), fp("Terms & conditions", "terms-and-conditions")],
    copyright: "© {year} GodPuja. All rights reserved.",
  }));
  console.log("  footer");

  // 7. Homepage.
  const hero = writeArt("hero.svg", bannerArt(["kalash", "diya", "thali"], "saffron", 1600, 1000));
  const banner1 = writeArt("banner-diwali.svg", bannerArt(["diya", "garland", "diya"], "kumkum"));
  const banner2 = writeArt("banner-idols.svg", bannerArt(["idol", "bell"], "gold"));
  const artisans = square("home-artisans", "samai", "sandal");
  let h = 0;
  const sec = (type: string, data: unknown) => ({ id: `h${++h}`, type, enabled: true, data });
  await updateHomepage(updateHomepageSchema.parse({
    baseUpdatedAt: null,
    sections: [
      sec("hero", { heading: "Everything for your puja, delivered with devotion", subheading: "Authentic samagri, handcrafted brass and ready-to-use festival kits — packed with care and delivered across India.", imageUrl: hero, imageAlt: "Brass kalash, a lit diya and a puja thali", ctaLabel: "Shop puja kits", ctaUrl: "/category/puja-kits", secondaryCtaLabel: "Explore idols", secondaryCtaUrl: "/category/idols" }),
      sec("featuredCategories", { heading: "Shop by category", categoryIds: CATEGORIES.map((c) => catId.get(c.slug)!) }),
      sec("featuredProducts", { heading: "Handpicked for your mandir", category: "", limit: 8 }),
      sec("offer", { heading: "Festive season prices are live", text: "Up to 20% off Diwali kits, diyas and brass idols. Prices already reduced — no code needed.", code: "", ctaLabel: "Shop festival kits", ctaUrl: "/category/puja-kits/festival-kits", expiresAt: "" }),
      sec("banner", { items: [
        { imageUrl: banner1, imageAlt: "Clay diyas and a marigold garland", heading: "Light up Diwali", text: "Hand-painted diyas from potter families in Rajasthan.", linkUrl: "/category/diyas-lamps" },
        { imageUrl: banner2, imageAlt: "Brass idol and puja bell", heading: "Brass idols & bells", text: "Cast and finished by artisans in Moradabad.", linkUrl: "/category/idols" },
      ] }),
      sec("bestSellers", { heading: "Best sellers", category: "", limit: 8 }),
      sec("imageText", { heading: "Made by artisans, chosen by priests", markdown: "Every brass piece is cast and polished by hand in Moradabad, our diyas are fired by potter families in Rajasthan, and our samagri kits are checked against puja vidhi by practising pandits.\n\n- Authentic, pure ingredients\n- Fair prices for artisans\n- Carefully packed so nothing breaks", imageUrl: artisans, imageAlt: "Brass samai lamp with lit wicks", imagePosition: "left", ctaLabel: "Our story", ctaUrl: "/about-us" }),
      sec("latestProducts", { heading: "New arrivals", category: "", limit: 8 }),
      sec("testimonials", { heading: "Loved by families across India", items: [
        { quote: "The Diwali kit had everything, even the vidhi booklet. Our first Lakshmi puja in the new house went perfectly.", author: "Priya S.", role: "Pune" },
        { quote: "The brass Ganesha is heavier and more beautiful than I expected. Packed so well it survived a long courier trip.", author: "Rakesh M.", role: "Bengaluru" },
        { quote: "I reorder the monthly puja refill every month — it saves me a trip to the market.", author: "Anita G.", role: "Delhi" },
      ] }),
    ],
  }));
  console.log("  homepage");

  // 8. SEO / site settings.
  await updateSeoSettings(updateSeoSettingsSchema.parse({
    baseUpdatedAt: null,
    siteName: "GodPuja",
    defaultTitle: "GodPuja — Puja samagri, idols & festival kits online",
    defaultDescription: "Shop authentic puja samagri, brass idols, diyas, incense and ready-to-use festival puja kits. Delivered across India.",
    defaultOgImage: hero, twitterHandle: "", logoUrl: "",
    homeTitle: "GodPuja — Puja samagri, idols & festival kits online",
    homeDescription: "Authentic puja samagri, handcrafted brass idols, diyas and complete puja kits for Diwali, Navratri and daily worship.",
  }));
  console.log("  seo settings");

  const files = fs.readdirSync(DEMO_DIR).length;
  console.log(`\nDone. ${files} illustrations in public/demo/. Users were kept. Restart the dev server to clear cached pages.`);
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
