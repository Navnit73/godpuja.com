import { ApiError } from "../api";
import { connectDB } from "../db";
import { Footer, type FooterDoc } from "../models/Footer";
import { Page } from "../models/Page";
import { Subscriber } from "../models/Subscriber";
import { liveSlugs, pageHref } from "./menus";
import { emptyFooter, type FooterInput, type FooterLinkInput, type UpdateFooterInput } from "@/lib/validation/footer";

export type AdminFooter = FooterInput & { updatedAt: string | null };

const allLinks = (f: FooterInput): FooterLinkInput[] => [...f.columns.flatMap((c) => c.links), ...f.legalLinks];
const pageRefsOf = (f: FooterInput) => [...new Set(allLinks(f).filter((l) => l.type === "page" && l.ref).map((l) => l.ref as string))];

function toInput(d: FooterDoc): FooterInput {
  return { columns: d.columns ?? [], social: d.social ?? [], contact: { ...emptyFooter.contact, ...d.contact }, newsletter: { ...emptyFooter.newsletter, ...d.newsletter }, legalLinks: d.legalLinks ?? [], copyright: d.copyright ?? "" };
}

/** Until the first save there is no document; the editor starts from defaults (`updatedAt: null`). */
export async function getFooter(): Promise<AdminFooter> {
  await connectDB();
  const d = await Footer.findOne({ key: "main" }).lean();
  return d ? { ...toInput(d), updatedAt: d.updatedAt.toISOString() } : { ...emptyFooter, updatedAt: null };
}

export async function updateFooter({ baseUpdatedAt, ...input }: UpdateFooterInput): Promise<AdminFooter> {
  await connectDB();
  const refs = pageRefsOf(input);
  if (refs.length) {
    const found = new Set((await Page.find({ _id: { $in: refs } }).select("_id").lean()).map((p) => String(p._id)));
    if (refs.some((r) => !found.has(r))) throw new ApiError("VALIDATION_ERROR", "Some linked pages no longer exist. Choose another page.", { links: "A linked page was deleted" });
  }
  const stale = new ApiError("CONFLICT", "The footer was changed by someone else. Reload to see their changes before saving.");
  let saved;
  if (baseUpdatedAt === null) {
    // First save: only succeeds if nobody created it meanwhile (unique key).
    try {
      saved = (await Footer.create({ key: "main", ...input })).toObject() as FooterDoc;
    } catch (err) {
      if ((err as { code?: number }).code === 11000) throw stale;
      throw err;
    }
  } else {
    saved = await Footer.findOneAndUpdate({ key: "main", updatedAt: new Date(baseUpdatedAt) }, { $set: input }, { returnDocument: "after" }).lean();
    if (!saved) throw stale;
  }
  return { ...toInput(saved), updatedAt: saved.updatedAt.toISOString() };
}

// ---------- Public (storefront) ----------

export type PublicLink = { id: string; label: string; href: string; external: boolean; newTab: boolean };
export type PublicFooter = {
  columns: { id: string; heading: string; links: PublicLink[] }[];
  social: { id: string; platform: string; url: string }[];
  contact: FooterInput["contact"];
  newsletter: { enabled: boolean; heading: string; text: string };
  legalLinks: PublicLink[];
  copyright: string;
};

/** Resolves the stored footer for visitors: hides disabled items, dead page links and empty columns. */
export async function findPublicFooter(now = new Date()): Promise<PublicFooter | null> {
  await connectDB();
  const d = await Footer.findOne({ key: "main" }).lean();
  if (!d) return null;
  const f = toInput(d);
  const slugs = await liveSlugs(pageRefsOf(f), now);
  const resolve = (links: FooterLinkInput[]): PublicLink[] => {
    const out: PublicLink[] = [];
    for (const l of links) {
      if (!l.enabled) continue;
      const href = l.type === "page" ? (l.ref && slugs.has(l.ref) ? pageHref(slugs.get(l.ref)!) : "") : l.url ?? "";
      if (href) out.push({ id: l.id, label: l.label, href, external: /^https?:\/\//i.test(href), newTab: l.openInNewTab });
    }
    return out;
  };
  return {
    columns: f.columns.filter((c) => c.enabled).map((c) => ({ id: c.id, heading: c.heading, links: resolve(c.links) })).filter((c) => c.links.length),
    social: f.social.filter((s) => s.enabled).map(({ id, platform, url }) => ({ id, platform, url })),
    contact: f.contact,
    newsletter: f.newsletter,
    legalLinks: resolve(f.legalLinks),
    copyright: f.copyright.replaceAll("{year}", String(now.getFullYear())),
  };
}

// ---------- Newsletter ----------

/** Idempotent: subscribing twice is not an error and reveals nothing about existing addresses. */
export async function subscribe(email: string, source = "footer") {
  await connectDB();
  try {
    await Subscriber.updateOne({ email }, { $setOnInsert: { email, source } }, { upsert: true });
  } catch (err) {
    // Two identical requests can race the upsert; the loser hits the unique index, which still means "subscribed".
    if ((err as { code?: number }).code !== 11000) throw err;
  }
}
