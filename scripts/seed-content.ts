/**
 * Content seed for the MAIN database (the one `next dev` uses): fills the store and every Phase 1 content area, and rebuilds the
 * homepage, header/mobile menus and footer to match PRD v1.1 and what has been built so far.
 *
 *   npm run seed:content            # dry run: prints what would be created
 *   npm run seed:content -- --apply # writes
 *
 * ADDITIVE and idempotent: nothing is deleted, anything with the same slug / code is skipped, users, orders, media and existing
 * CMS pages are untouched. The ONLY things replaced are the homepage layout, the header + mobile menus, the footer and the SEO
 * defaults (a JSON backup of the old ones is written to the OS temp folder first).
 *
 * Everything created is SAMPLE content. Religious texts and Pooja Vidhi guides are marked "Sample content (pending review)" as
 * their reviewer; have a qualified person proof-read them before launch.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { config } from "dotenv";
config({ path: ".env.local", override: true, quiet: true });
import mongoose from "mongoose";
import { connectDB } from "../src/server/db";
import { env } from "../src/server/env";
import { Category } from "../src/server/models/Category";
import { Coupon } from "../src/server/models/Coupon";
import { Devotional } from "../src/server/models/Devotional";
import { Menu } from "../src/server/models/Menu";
import { Page } from "../src/server/models/Page";
import { Product } from "../src/server/models/Product";
import { Vidhi } from "../src/server/models/Vidhi";
import { createCategory } from "../src/server/services/categories";
import { createCoupon } from "../src/server/services/coupons";
import { createDevotional, setDevotionalPublishState } from "../src/server/services/devotional";
import { getFooter, updateFooter } from "../src/server/services/footer";
import { getHomepage, updateHomepage } from "../src/server/services/homepage";
import { updateMenu } from "../src/server/services/menus";
import { createPage, setPublishState } from "../src/server/services/pages";
import { createProduct } from "../src/server/services/products";
import { getSeoSettings, updateSeoSettings } from "../src/server/services/settings";
import { createVidhi, setVidhiPublishState } from "../src/server/services/vidhi";
import { categoryInputSchema, productInputSchema } from "../src/lib/validation/catalog";
import { couponSchema } from "../src/lib/validation/coupons";
import { devotionalInputSchema, emptyDevotional } from "../src/lib/validation/devotional";
import { updateFooterSchema } from "../src/lib/validation/footer";
import { updateHomepageSchema } from "../src/lib/validation/homepage";
import { updateMenuSchema, type MenuItemInput } from "../src/lib/validation/menus";
import { pageInputSchema } from "../src/lib/validation/pages";
import { updateSeoSettingsSchema } from "../src/lib/validation/seo";
import { emptyVidhi, vidhiInputSchema } from "../src/lib/validation/vidhi";
import { bannerArt, productArt, type Motif, type PALETTES } from "./demo/art";
import { CATEGORIES, PRODUCTS, type DemoCategory } from "./demo/catalog";
import { DEVOTIONALS } from "./content/devotionals";
import { POSTS } from "./content/posts";
import { EXTRA_CATEGORIES, EXTRA_PRODUCTS } from "./content/products";
import { GUIDES } from "./content/vidhi";
import { LEGAL_PAGES } from "./legal/pages";

const APPLY = process.argv.includes("--apply");
const rupees = (n: number) => Math.round(n * 100);
const noSeo = { title: "", description: "", canonical: "", ogImage: "", noindex: false };
const REVIEWER = { reviewer: "Sample content (pending review)", reviewedAt: new Date().toISOString() };

const DEMO_DIR = path.resolve("public/demo");
const SITE = env().SITE_URL.replace(/\/$/, "");
const art = (file: string, svg: string) => { if (APPLY) fs.writeFileSync(path.join(DEMO_DIR, file), svg); return `${SITE}/demo/${file}`; };
const square = (name: string, motif: Motif, palette: keyof typeof PALETTES) => art(`${name}.svg`, productArt(motif, palette));
const counts: Record<string, number> = {};
const bump = (k: string) => { counts[k] = (counts[k] ?? 0) + 1; };

async function main() {
  await connectDB();
  const db = mongoose.connection.db!;
  console.log(`Database: ${db.databaseName}${APPLY ? "" : "  (dry run: nothing is written)"}  ·  image base: ${SITE}/demo/\n`);
  if (APPLY) fs.mkdirSync(DEMO_DIR, { recursive: true });

  if (APPLY) {
    const backup: Record<string, unknown> = {};
    for (const c of ["homepages", "footers", "menus", "settings"]) backup[c] = await db.collection(c).find({}).toArray();
    const file = path.join(os.tmpdir(), `godpuja-seed-backup-${Date.now()}.json`);
    fs.writeFileSync(file, JSON.stringify(backup, null, 2));
    console.log(`Backed up homepage, footer, menus and settings to ${file}\n`);
  }

  // ---------- 1. categories
  const catId = new Map<string, string>();
  const allCats: DemoCategory[] = [...CATEGORIES, ...EXTRA_CATEGORIES];
  for (const [i, c] of allCats.entries()) {
    const existing = await Category.findOne({ path: c.slug }).select("_id").lean();
    let topId = existing ? String(existing._id) : "";
    if (!existing) {
      bump("categories");
      if (APPLY) topId = (await createCategory(categoryInputSchema.parse({ name: c.name, slug: c.slug, parent: null, description: c.description, order: i, isActive: true, seo: noSeo, image: { url: square(`cat-${c.slug}`, c.motif, c.palette), alt: `${c.name} illustration` } }))).id;
    }
    catId.set(c.slug, topId);
    for (const [j, s] of c.children.entries()) {
      const ex = await Category.findOne({ path: `${c.slug}/${s.slug}` }).select("_id").lean();
      let id = ex ? String(ex._id) : "";
      if (!ex) {
        bump("categories");
        if (APPLY) id = (await createCategory(categoryInputSchema.parse({ name: s.name, slug: s.slug, parent: topId, description: s.description, order: j, isActive: true, seo: noSeo, image: { url: square(`cat-${c.slug}-${s.slug}`, s.motif, s.palette), alt: `${s.name} illustration` } }))).id;
      }
      catId.set(`${c.slug}/${s.slug}`, id);
    }
  }

  // ---------- 2. products (the original demo catalogue + the PRD §5.1 additions)
  const allProducts = [...PRODUCTS, ...EXTRA_PRODUCTS];
  for (const [i, p] of allProducts.entries()) {
    if (await Product.exists({ slug: p.slug })) continue;
    bump("products");
    if (!APPLY) continue;
    const images = [p.palette, "sandal"].map((pal, k) => ({ url: square(`p-${p.slug}-${k + 1}`, p.motif, pal as keyof typeof PALETTES), alt: k === 0 ? `${p.name} — illustration` : `${p.name} — alternate view` }));
    const description = [p.short, "", "## Highlights", ...p.highlights.map((h) => `- ${h}`), ...(p.contents ? ["", "## What's in the box", ...p.contents.map((c) => `- ${c}`)] : []),
      "", "## Care", p.care ?? "Store in a cool, dry place away from direct sunlight. Keep away from children when lit.", "", "_Images are illustrations; the product may vary slightly as each piece is handmade._"].join("\n");
    const hasVariants = !!p.variants?.length;
    const created = await createProduct(productInputSchema.parse({
      name: p.name, slug: p.slug, sku: `GP-${String(i + 1).padStart(3, "0")}`, shortDescription: p.short, description, images, category: catId.get(p.category) ?? null, brand: p.brand,
      price: rupees(p.price), salePrice: p.salePrice ? rupees(p.salePrice) : null, stock: hasVariants ? 0 : p.stock, lowStockThreshold: 5, status: "active", isFeatured: !!p.featured,
      attributes: p.attributes.map(([name, value]) => ({ name, value })),
      variants: (p.variants ?? []).map((v) => ({ sku: v.sku, options: v.options, price: v.price ? rupees(v.price) : null, salePrice: v.salePrice ? rupees(v.salePrice) : null, stock: v.stock })),
      shipping: { weightGrams: p.weight, length: 0, width: 0, height: 0, freeShipping: p.price >= 999 }, seo: noSeo,
    }));
    await Product.updateOne({ _id: created.id }, { $set: { soldCount: p.sold, createdAt: new Date(Date.now() - (allProducts.length - i) * 36e5 * 7) } }, { timestamps: false });
  }

  // ---------- 3. aarti, mantras, chalisa, stotras (published; related links added in step 5)
  for (const d of DEVOTIONALS) {
    if (await Devotional.exists({ slug: d.slug })) continue;
    bump(`devotionals (${d.type})`);
    if (!APPLY) continue;
    const created = await createDevotional(devotionalInputSchema.parse({
      ...emptyDevotional, title: d.title, slug: d.slug, type: d.type, deity: d.deity, language: d.language, lyrics: d.lyrics, transliteration: d.transliteration ?? "", meaning: d.meaning, summary: d.summary, tags: d.tags,
      coverImageUrl: square(`dev-${d.slug}`, d.type === "aarti" ? "diya" : d.type === "mantra" ? "mala" : "bell", d.type === "aarti" ? "saffron" : d.type === "mantra" ? "tulsi" : "gold"), coverImageAlt: `${d.title} illustration`, ...REVIEWER,
    }));
    await setDevotionalPublishState(created.id, { action: "publish" });
  }

  // ---------- 4. Pooja Vidhi guides
  const motifFor = (deity: string): Motif => (/Ganesh|Lakshmi|Durga|Krishna|Hanuman|Shiva/.test(deity) ? "idol" : "kit");
  for (const [i, g] of GUIDES.entries()) {
    if (await Vidhi.exists({ slug: g.slug })) continue;
    bump("pooja vidhi guides");
    if (!APPLY) continue;
    const created = await createVidhi(vidhiInputSchema.parse({
      ...emptyVidhi, title: g.title, slug: g.slug, category: g.category, deity: g.deity, summary: g.summary, significance: g.significance, preparation: g.preparation, durationMinutes: g.minutes,
      samagri: g.samagri.map(([item, quantity, productSlug]) => ({ item, quantity, note: "", productSlug: productSlug ?? "" })),
      steps: g.steps.map(([title, body, mantra]) => ({ title, body, mantra: mantra ?? "" })),
      relatedProducts: g.products, relatedAarti: g.aarti, tags: g.tags, author: "GodPuja Editorial", ...REVIEWER,
      coverImageUrl: square(`vidhi-${g.slug}`, motifFor(g.deity), (["saffron", "gold", "kumkum", "tulsi", "sandal"] as const)[i % 5]), coverImageAlt: `${g.title} illustration`,
    }));
    await setVidhiPublishState(created.id, { action: "publish" });
  }

  // ---------- 5. cross links: related guides on each guide; guides on each aarti/mantra
  if (APPLY) {
    const slugs = GUIDES.map((g) => g.slug);
    for (const [i, g] of GUIDES.entries()) await Vidhi.updateOne({ slug: g.slug }, { $set: { relatedVidhi: [slugs[(i + 1) % slugs.length], slugs[(i + 2) % slugs.length]].filter((s) => s !== g.slug) } }, { timestamps: false });
    const have = new Set((await Devotional.find().select("slug").lean()).map((d) => d.slug));
    for (const d of DEVOTIONALS) {
      const guides = GUIDES.filter((g) => g.aarti.includes(d.slug)).map((g) => g.slug).slice(0, 3);
      await Devotional.updateOne({ slug: d.slug }, { $set: { relatedAarti: (d.related ?? []).filter((s) => have.has(s) && s !== d.slug), relatedVidhi: guides } }, { timestamps: false });
    }
  }

  // ---------- 6. blog posts, guides, and the legal pages
  const pageId = new Map<string, string>();
  for (const [i, p] of POSTS.entries()) {
    const ex = await Page.findOne({ slug: p.slug }).select("_id").lean();
    if (ex) { pageId.set(p.slug, String(ex._id)); continue; }
    bump(p.kind === "blog" ? "blog posts" : "guides (CMS)");
    if (!APPLY) continue;
    const created = await createPage(pageInputSchema.parse({
      kind: p.kind, title: p.title, slug: p.slug, description: p.description, seo: noSeo,
      coverImageUrl: square(`post-${p.slug.replace("/", "-")}`, p.motif, p.palette), coverImageAlt: `${p.title} illustration`,
      sections: [{ id: "s1", type: "richtext", enabled: true, data: { markdown: p.markdown } }],
    }));
    await setPublishState(created.id, { action: "publish" });
    pageId.set(p.slug, created.id);
    void i;
  }
  for (const p of LEGAL_PAGES) {
    const ex = await Page.findOne({ slug: p.slug }).select("_id").lean();
    if (ex) continue;
    bump("legal pages");
    if (!APPLY) continue;
    const created = await createPage(pageInputSchema.parse({ title: p.title, slug: p.slug, description: p.description, seo: noSeo, sections: [{ id: "s1", type: "richtext", enabled: true, data: { markdown: p.markdown } }] }));
    await setPublishState(created.id, { action: "publish" }); // sample text: review before launch
  }
  const pageBySlug = async (slug: string) => { const p = await Page.findOne({ slug }).select("_id").lean(); return p ? String(p._id) : null; };

  // ---------- 7. coupons
  for (const c of [
    { code: "WELCOME10", description: "10% off your first order, up to ₹200", type: "percent", value: 10, maxDiscount: rupees(200), minSubtotal: rupees(499), perCustomerLimit: 1 },
    { code: "FESTIVE100", description: "₹100 off orders above ₹999", type: "fixed", value: rupees(100), minSubtotal: rupees(999) },
  ] as const) {
    if (await Coupon.exists({ code: c.code })) continue;
    bump("coupons");
    if (APPLY) await createCoupon(couponSchema.parse(c));
  }

  // ---------- 8. navigation, footer, homepage, SEO defaults (replaced; old versions are in the backup file)
  let n = 0;
  const link = (label: string, url: string, children: MenuItemInput[] = []): MenuItemInput => ({ id: `m${++n}`, label, type: "external", url, openInNewTab: false, enabled: true, showOnDesktop: true, showOnMobile: true, children });
  const shopMenu = () => link("Shop", "/shop", CATEGORIES.concat(EXTRA_CATEGORIES).map((c) => link(c.name, `/shop/${c.slug}`, c.children.slice(0, 8).map((s) => link(s.name, `/shop/${c.slug}/${s.slug}`)))));
  const vidhiMenu = () => link("Pooja Vidhi", "/pooja-vidhi", [["Daily pooja", "daily"], ["Festival pooja", "festival"], ["Special pooja", "special"], ["Vrat & katha", "vrat-katha"], ["Step-by-step guides", "step-by-step"]].map(([l, k]) => link(l, `/pooja-vidhi?category=${k}`)));
  const aartiMenu = () => link("Aarti & Mantras", "/aarti", [link("Aarti", "/aarti"), link("Mantras", "/mantras?type=mantra"), link("Chalisa", "/mantras?type=chalisa"), link("Stotras", "/mantras?type=stotra")]);
  const about = await pageBySlug("about-us");
  const header: MenuItemInput[] = [shopMenu(), vidhiMenu(), aartiMenu(), link("Blog", "/blog"), link("Guides", "/guides"), ...(about ? [{ ...link("About", "/about-us"), type: "page" as const, ref: about, url: undefined }] : [])];
  const mobile: MenuItemInput[] = [link("Home", "/"), ...header.map((h) => ({ ...h, id: `mm${++n}`, children: h.children.map((c) => ({ ...c, id: `mm${++n}`, children: [] })) })), link("My account", "/account")];

  let f = 0;
  const fl = (label: string, url: string) => ({ id: `f${++f}`, label, type: "external" as const, url, openInNewTab: false, enabled: true });
  const fp = async (label: string, slug: string) => { const ref = await pageBySlug(slug); return ref ? [{ id: `f${++f}`, label, type: "page" as const, ref, openInNewTab: false, enabled: true }] : []; };
  const columns = [
    { id: "c-shop", heading: "Shop", enabled: true, links: [fl("All products", "/shop"), ...CATEGORIES.concat(EXTRA_CATEGORIES).slice(0, 8).map((c) => fl(c.name, `/shop/${c.slug}`)), fl("Festival collections", "/shop/festival-collections")].slice(0, 12) },
    { id: "c-learn", heading: "Learn & listen", enabled: true, links: [fl("Pooja Vidhi", "/pooja-vidhi"), fl("Aarti", "/aarti"), fl("Mantras", "/mantras"), fl("Chalisa & stotras", "/mantras?type=chalisa"), fl("Blog", "/blog"), fl("Guides", "/guides")] },
    { id: "c-account", heading: "My account", enabled: true, links: [fl("Sign in", "/login"), fl("Create an account", "/register"), fl("My orders", "/account/orders"), fl("Wishlist", "/account/wishlist"), fl("Saved addresses", "/account/addresses")] },
    { id: "c-support", heading: "Support", enabled: true, links: [...(await fp("About us", "about-us")), ...(await fp("Contact us", "contact-us")), ...(await fp("FAQs", "faq")), ...(await fp("Shipping & delivery", "shipping-policy")), ...(await fp("Returns & refunds", "returns-refunds")), fl("Search", "/search")] },
    { id: "c-soon", heading: "Coming soon", enabled: true, links: [fl("Find Temples", "/temples"), fl("Book a Pooja", "/book-a-pooja"), fl("Donate", "/donate")] },
  ];
  const legalLinks = [...(await fp("Privacy policy", "privacy-policy")), ...(await fp("Terms & conditions", "terms-and-conditions")), ...(await fp("Cookie policy", "cookies")), ...(await fp("Data retention", "data-retention"))];

  const hero = art("hero-v2.svg", bannerArt(["kalash", "diya", "thali"], "saffron", 1600, 1000));
  const bFestival = art("banner-festival-v2.svg", bannerArt(["garland", "diya", "garland"], "kumkum"));
  const bGifts = art("banner-gifts-v2.svg", bannerArt(["kit", "idol"], "gold"));
  const artisans = square("home-artisans-v2", "samai", "sandal");
  let h = 0;
  const sec = (type: string, data: unknown) => ({ id: `h${++h}`, type, enabled: true, data });
  const featuredCats = ["puja-kits", "idols", "diyas-lamps", "incense-dhoop", "puja-essentials", "rudraksha-malas", "religious-books", "festival-collections"];

  if (APPLY) {
    for (const [key, items] of [["header", header], ["mobile", mobile]] as const) {
      const m = await Menu.findOne({ key }).lean();
      if (!m) { console.log(`  (no "${key}" menu exists: create it in /admin/navigation first)`); continue; }
      await updateMenu(String(m._id), updateMenuSchema.parse({ name: m.name, items, baseUpdatedAt: m.updatedAt.toISOString() }));
    }
    const cur = await getFooter();
    await updateFooter(updateFooterSchema.parse({
      baseUpdatedAt: cur.updatedAt, columns, social: cur.social ?? [], contact: cur.contact, newsletter: cur.newsletter, legalLinks, copyright: cur.copyright || "© {year} GodPuja. All rights reserved.",
    }));
    const home = await getHomepage();
    await updateHomepage(updateHomepageSchema.parse({
      baseUpdatedAt: home.updatedAt,
      sections: [
        sec("hero", { heading: "Everything for your puja, in one place", subheading: "Shop authentic samagri and idols, learn each pooja step by step, and listen to aarti and mantras with their meaning.", imageUrl: hero, imageAlt: "Brass kalash, lit diya and puja thali", ctaLabel: "Shop now", ctaUrl: "/shop", secondaryCtaLabel: "Explore Pooja Vidhi", secondaryCtaUrl: "/pooja-vidhi" }),
        sec("pillars", { heading: "Explore GodPuja" }),
        sec("featuredCategories", { heading: "Shop by category", categoryIds: featuredCats.map((s) => catId.get(s)).filter(Boolean) }),
        sec("featuredProducts", { heading: "Handpicked for your mandir", category: "", limit: 8 }),
        sec("banner", { items: [
          { imageUrl: bFestival, imageAlt: "Marigold garlands and diyas", heading: "Festival collections", text: "Diwali, Navratri, Janmashtami, Holi and more.", linkUrl: "/shop/festival-collections" },
          { imageUrl: bGifts, imageAlt: "Gift box and brass idol", heading: "Spiritual gifts", text: "Hampers and gift sets for every occasion.", linkUrl: "/shop/spiritual-gifts" },
        ] }),
        sec("vidhiHighlights", { heading: "Learn the pooja, step by step", limit: 3 }),
        sec("devotionalHighlights", { heading: "Aarti & Mantras", kind: "all", limit: 6 }),
        sec("offer", { heading: "Welcome offer", text: "10% off your first order above ₹499, up to ₹200.", code: "WELCOME10", ctaLabel: "Start shopping", ctaUrl: "/shop", expiresAt: "" }),
        sec("bestSellers", { heading: "Best sellers", category: "", limit: 8 }),
        sec("imageText", { heading: "Made by artisans, checked against the vidhi", markdown: "Our brass is cast and polished by hand, our diyas are fired by potter families, and every kit is checked against the pooja vidhi it is meant for.", imageUrl: artisans, imageAlt: "Brass lamp illustration", imagePosition: "left", ctaLabel: "Read about us", ctaUrl: "/about-us" }),
        sec("latestProducts", { heading: "New arrivals", category: "", limit: 8 }),
        sec("latestPosts", { heading: "From our blog", kind: "blog", limit: 3 }),
        sec("testimonials", { heading: "Loved by families across India", items: [
          { quote: "The Diwali kit had everything, even the vidhi booklet. Our first Lakshmi puja in the new house went perfectly.", author: "Priya S.", role: "Pune" },
          { quote: "The guide on the website walked us through Ganesh Chaturthi step by step. We bought the whole samagri from the same page.", author: "Rakesh M.", role: "Bengaluru" },
          { quote: "I read the aarti with my children from the site every evening.", author: "Anita G.", role: "Delhi" },
        ] }),
      ],
    }));
    const seo = await getSeoSettings();
    const { updatedAt, ...rest } = seo;
    await updateSeoSettings(updateSeoSettingsSchema.parse({
      ...rest, baseUpdatedAt: updatedAt, defaultTitle: "GodPuja — Puja samagri, Pooja Vidhi, Aarti & Mantras", defaultDescription: "Shop puja samagri and idols, learn pooja vidhi step by step, and read aarti and mantras with meaning.",
      homeTitle: "GodPuja — Puja samagri, Pooja Vidhi, Aarti & Mantras", homeDescription: "Authentic puja samagri, step-by-step pooja vidhi, and aarti and mantras with meaning. Delivered across India.", defaultOgImage: hero,
    }));
  } else {
    console.log(`Would rebuild: header + mobile menus (${header.length} / ${mobile.length} items), footer (${columns.length} columns, ${legalLinks.length} legal links), homepage (13 sections), SEO defaults`);
  }

  console.log(APPLY ? "\nCreated:" : "\nWould create:");
  for (const [k, v] of Object.entries(counts)) console.log(`  ${String(v).padStart(3)}  ${k}`);
  console.log(`  ${String(Object.values(counts).reduce((a, b) => a + b, 0)).padStart(3)}  total new records`);
  if (APPLY) console.log("\nDone. Cached pages refresh within a few minutes; restart `next dev` to see everything immediately.");
  await mongoose.disconnect();
}

main().catch(async (e) => { console.error(e); await mongoose.disconnect().catch(() => {}); process.exit(1); });
