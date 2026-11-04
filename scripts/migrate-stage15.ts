/**
 * Stage 15 data migration: copy the old Guides (CMS pages of kind "guide") into Pooja Vidhi as DRAFTS.
 * Idempotent; the original guides are never changed or unpublished.
 *
 *   npm run migrate:stage15            # dry run: lists what would be created
 *   npm run migrate:stage15 -- --apply # creates the drafts
 *
 * Each guide becomes a draft with category "Step-by-step guide", its description as the introduction, and all of its
 * sections joined as Markdown in "Additional text". An editor then restructures it (samagri, steps, mantras), adds a
 * reviewer and review date, and publishes. Nothing goes live by itself.
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });
import crypto from "node:crypto";
import mongoose from "mongoose";
import { connectDB } from "../src/server/db";
import { Page } from "../src/server/models/Page";
import { Vidhi } from "../src/server/models/Vidhi";
import { sectionsToMarkdown, type Section } from "../src/lib/vidhi-migrate";

const apply = process.argv.includes("--apply");
async function main() {
  await connectDB();
  console.log(`${apply ? "APPLYING" : "DRY RUN"} on database "${mongoose.connection.name}"`);
  const guides = await Page.find({ kind: "guide" }).sort({ createdAt: 1 }).lean();
  let created = 0, skipped = 0;
  for (const g of guides) {
    const slug = g.slug.replace(/^guides\//, "");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) { console.log(`skip  ${g.slug}: cannot be used as a guide slug`); skipped++; continue; }
    if (await Vidhi.exists({ slug })) { console.log(`skip  ${g.slug}: /pooja-vidhi/${slug} already exists`); skipped++; continue; }
    console.log(`${apply ? "create" : "would create"}  ${g.slug} -> /pooja-vidhi/${slug}  (${g.status})`);
    if (apply) {
      await Vidhi.create({
        title: g.title, slug, category: "step-by-step", summary: (g.description ?? "").slice(0, 2000), body: sectionsToMarkdown((g.sections ?? []) as Section[]).slice(0, 20_000),
        coverImageUrl: g.coverImageUrl ?? "", coverImageAlt: g.coverImageAlt ?? "",
        seo: { title: g.seo?.title ?? "", description: g.seo?.description ?? "", canonical: "", ogImage: g.seo?.ogImage ?? "", noindex: !!g.seo?.noindex },
        status: "draft", previewToken: crypto.randomBytes(24).toString("base64url"),
      });
    }
    created++;
  }
  console.log(`${guides.length} old guides: ${apply ? "created" : "would create"} ${created}, skipped ${skipped}`);
  if (!apply) console.log("Nothing written. Re-run with --apply to create the drafts.");
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
