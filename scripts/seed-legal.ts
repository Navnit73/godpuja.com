/**
 * Stage 17: create the Cookie policy and Data retention pages as DRAFTS (never overwrites an existing page).
 *
 *   npm run seed:legal            # dry run: shows what would be created
 *   npm run seed:legal -- --apply # creates the drafts
 *
 * The text describes what the app does today but is NOT legal advice: the owner must review it, then publish from
 * /admin/pages. The existing Privacy policy needs a short analytics paragraph before GA4 is switched on (printed below).
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true, quiet: true });
import mongoose from "mongoose";
import { connectDB } from "../src/server/db";
import { Page } from "../src/server/models/Page";
import { createPage } from "../src/server/services/pages";
import { pageInputSchema } from "../src/lib/validation/pages";
import { LEGAL_PAGES, PRIVACY_ANALYTICS_NOTE } from "./legal/pages";

async function main() {
  const apply = process.argv.includes("--apply");
  await connectDB();
  console.log(`Database: ${mongoose.connection.name}${apply ? "" : " (dry run)"}`);
  for (const p of LEGAL_PAGES) {
    if (await Page.exists({ slug: p.slug })) { console.log(`  skip   /${p.slug} (already exists)`); continue; }
    if (!apply) { console.log(`  would create draft /${p.slug}`); continue; }
    await createPage(pageInputSchema.parse({
      title: p.title, slug: p.slug, description: p.description, seo: { title: "", description: "", canonical: "", ogImage: "", noindex: false },
      sections: [{ id: "s1", type: "richtext", enabled: true, data: { markdown: p.markdown } }],
    }));
    console.log(`  created draft /${p.slug}`);
  }
  console.log(`\nPrivacy policy: ${(await Page.exists({ slug: "privacy-policy" })) ? "add this paragraph (the demo text says there are no trackers):" : "none exists; create one that includes:"}\n\n${PRIVACY_ANALYTICS_NOTE}\n`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
