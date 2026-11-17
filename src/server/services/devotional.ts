import crypto from "node:crypto";
import mongoose from "mongoose";
import { ApiError } from "../api";
import { connectDB } from "../db";
import { renderMarkdown } from "../markdown";
import { Devotional, type DevotionalDoc } from "../models/Devotional";
import { Product } from "../models/Product";
import { Vidhi } from "../models/Vidhi";
import { clearRedirectsFrom, dropRedirectsTo, recordRedirects } from "./redirects";
import { findCards, VISIBLE_STATUSES, type PublicProduct } from "./products";
import { plainExcerpt } from "@/lib/excerpt";
import {
  devotionalHref, devotionalLanguageLabel, devotionalTypeLabel, MANTRA_TYPE_KEYS,
  type DevotionalInput, type DevotionalLanguage, type DevotionalType, type ListDevotionalInput,
} from "@/lib/validation/devotional";
import { audioPlayable, audioStatus, publishProblems, type AudioStatus } from "@/lib/devotional-rules";
import type { PublishInput } from "@/lib/validation/pages";

const isId = (id: string) => mongoose.isValidObjectId(id);
const iso = (d?: Date | null) => (d ? d.toISOString() : null);
const newToken = () => crypto.randomBytes(24).toString("base64url");
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type DevotionalStatus = DevotionalDoc["status"];
export const isLive = (p: { status: DevotionalStatus; publishAt?: Date | null }, now = new Date()) =>
  p.status === "published" || (p.status === "scheduled" && !!p.publishAt && p.publishAt <= now);
const liveFilter = (now: Date) => ({ $or: [{ status: "published" as const }, { status: "scheduled" as const, publishAt: { $lte: now } }] });

// ---------- admin ----------
export type AdminDevotional = Omit<DevotionalInput, "reviewedAt" | "rights"> & {
  id: string; reviewedAt: string; rights: Omit<DevotionalInput["rights"], "expiresAt"> & { expiresAt: string };
  audioStatus: AudioStatus; status: DevotionalStatus; publishAt: string | null; publishedAt: string | null; previewToken: string; createdAt: string; updatedAt: string;
};
export type DevotionalListItem = { id: string; title: string; slug: string; type: DevotionalType; language: DevotionalLanguage; status: DevotionalStatus; publishAt: string | null; updatedAt: string; live: boolean; reviewed: boolean; audio: AudioStatus };

function toAdmin(v: DevotionalDoc, now = new Date()): AdminDevotional {
  const r = v.rights;
  return {
    id: String(v._id), title: v.title, slug: v.slug, type: v.type, deity: v.deity ?? "", language: v.language ?? "sanskrit",
    lyrics: v.lyrics ?? "", transliteration: v.transliteration ?? "", meaning: v.meaning ?? "", summary: v.summary ?? "",
    audioUrl: v.audioUrl ?? "", audioDurationSeconds: v.audioDurationSeconds ?? null,
    rights: { source: r?.source ?? "", licence: r?.licence ?? "", reference: r?.reference ?? "", expiresAt: iso(r?.expiresAt) ?? "", withdrawn: !!r?.withdrawn },
    audioStatus: audioStatus(v.audioUrl, r, now),
    relatedAarti: v.relatedAarti ?? [], relatedVidhi: v.relatedVidhi ?? [], relatedProducts: v.relatedProducts ?? [], tags: v.tags ?? [],
    coverImageUrl: v.coverImageUrl ?? "", coverImageAlt: v.coverImageAlt ?? "", reviewer: v.reviewer ?? "", reviewedAt: iso(v.reviewedAt) ?? "",
    status: v.status, publishAt: iso(v.publishAt), publishedAt: iso(v.publishedAt), previewToken: v.previewToken,
    seo: { title: v.seo?.title ?? "", description: v.seo?.description ?? "", canonical: v.seo?.canonical ?? "", ogImage: v.seo?.ogImage ?? "", noindex: !!v.seo?.noindex },
    createdAt: v.createdAt.toISOString(), updatedAt: v.updatedAt.toISOString(),
  };
}

const normalise = (i: DevotionalInput) => ({
  ...i, reviewedAt: i.reviewedAt ? new Date(i.reviewedAt) : null,
  rights: { ...i.rights, expiresAt: i.rights.expiresAt ? new Date(i.rights.expiresAt) : null },
});

function dupSlug(err: unknown): never {
  if ((err as { code?: number }).code === 11000) throw new ApiError("CONFLICT", "An aarti or mantra with this URL already exists", { slug: "Already in use" });
  throw err;
}

/** Everything an item points at must exist, so a published page never carries a dead link. */
async function verifyRefs(input: DevotionalInput, selfSlug?: string) {
  await connectDB();
  const fields: Record<string, string> = {};
  if (input.relatedProducts.length) {
    const have = new Set((await Product.find({ slug: { $in: input.relatedProducts }, status: { $in: VISIBLE_STATUSES } }).select("slug").lean()).map((p) => p.slug));
    const bad = input.relatedProducts.filter((s) => !have.has(s));
    if (bad.length) fields.relatedProducts = `No such product in the shop: ${bad.join(", ")}`;
  }
  const others = input.relatedAarti.filter((s) => s !== selfSlug);
  if (others.length) {
    const have = new Set((await Devotional.find({ slug: { $in: others } }).select("slug").lean()).map((v) => v.slug));
    const bad = others.filter((s) => !have.has(s));
    if (bad.length) fields.relatedAarti = `No such aarti or mantra: ${bad.join(", ")}`;
  }
  if (input.relatedVidhi.length) {
    const have = new Set((await Vidhi.find({ slug: { $in: input.relatedVidhi } }).select("slug").lean()).map((v) => v.slug));
    const bad = input.relatedVidhi.filter((s) => !have.has(s));
    if (bad.length) fields.relatedVidhi = `No such Pooja Vidhi guide: ${bad.join(", ")}`;
  }
  if (Object.keys(fields).length) throw new ApiError("VALIDATION_ERROR", "Some links point to things that do not exist.", fields);
}

export async function listDevotionals({ q, status, type, page, limit }: ListDevotionalInput) {
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (q) { const rx = new RegExp(escapeRegex(q), "i"); filter.$or = [{ title: rx }, { slug: rx }, { deity: rx }]; }
  const [rows, total] = await Promise.all([
    Devotional.find(filter).select("title slug type language status publishAt updatedAt reviewer reviewedAt audioUrl rights").sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Devotional.countDocuments(filter),
  ]);
  const now = new Date();
  const items: DevotionalListItem[] = rows.map((v) => ({
    id: String(v._id), title: v.title, slug: v.slug, type: v.type, language: v.language, status: v.status, publishAt: iso(v.publishAt), updatedAt: v.updatedAt.toISOString(),
    live: isLive(v, now), reviewed: !!v.reviewer && !!v.reviewedAt, audio: audioStatus(v.audioUrl, v.rights, now),
  }));
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getDevotional(id: string): Promise<AdminDevotional> {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Item not found");
  await connectDB();
  const v = await Devotional.findById(id).lean();
  if (!v) throw new ApiError("NOT_FOUND", "Item not found");
  return toAdmin(v);
}

export async function createDevotional(input: DevotionalInput): Promise<AdminDevotional> {
  await verifyRefs(input);
  try {
    const v = await Devotional.create({ ...normalise(input), status: "draft", previewToken: newToken() });
    await clearRedirectsFrom([devotionalHref(v.type, v.slug)]);
    return toAdmin(v.toObject() as DevotionalDoc);
  } catch (err) { return dupSlug(err); }
}

const notPublishable = () => new ApiError("FORBIDDEN", "Only users who can publish may change a published item");

/** Content edit; compare-and-set on the version the editor loaded. Changing the slug or type keeps the old URL working. */
export async function updateDevotional(id: string, input: DevotionalInput, baseUpdatedAt: string, { draftOnly = false } = {}) {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Item not found");
  await connectDB();
  await verifyRefs(input, input.slug);
  let prev: { slug: string; type: DevotionalType } | null;
  try {
    prev = await Devotional.findOneAndUpdate({ _id: id, updatedAt: new Date(baseUpdatedAt), ...(draftOnly ? { status: "draft" as const } : {}) }, { $set: normalise(input) }, { returnDocument: "before" }).select("slug type").lean();
  } catch (err) { return dupSlug(err); }
  if (!prev) {
    const cur = await Devotional.findById(id).select("status").lean();
    if (!cur) throw new ApiError("NOT_FOUND", "Item not found");
    if (draftOnly && cur.status !== "draft") throw notPublishable();
    throw new ApiError("CONFLICT", "This item was changed by someone else. Reload to see their changes before saving.");
  }
  const from = devotionalHref(prev.type, prev.slug), to = devotionalHref(input.type, input.slug);
  if (from !== to) {
    await clearRedirectsFrom([to]);
    await recordRedirects([{ from, to }]);
  }
  if (prev.slug !== input.slug) await renameRefs(prev.slug, input.slug);
  return { item: await getDevotional(id), previousHref: from };
}

/** Other pages that listed this slug follow a rename (or lose it on delete), so no "related" link goes dead. */
async function renameRefs(oldSlug: string, newSlug: string) {
  const opt = { arrayFilters: [{ e: oldSlug }], timestamps: false };
  await Devotional.updateMany({ relatedAarti: oldSlug }, { $set: { "relatedAarti.$[e]": newSlug } }, opt);
  await Vidhi.updateMany({ relatedAarti: oldSlug }, { $set: { "relatedAarti.$[e]": newSlug } }, opt);
}

export async function deleteDevotional(id: string, { draftOnly = false } = {}) {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Item not found");
  await connectDB();
  const v = await Devotional.findOneAndDelete({ _id: id, ...(draftOnly ? { status: "draft" as const } : {}) }).select("slug type").lean();
  if (!v) {
    if (draftOnly && (await Devotional.exists({ _id: id }))) throw notPublishable();
    throw new ApiError("NOT_FOUND", "Item not found");
  }
  await dropRedirectsTo([devotionalHref(v.type, v.slug)]);
  await Devotional.updateMany({ relatedAarti: v.slug }, { $pull: { relatedAarti: v.slug } }, { timestamps: false });
  await Vidhi.updateMany({ relatedAarti: v.slug }, { $pull: { relatedAarti: v.slug } }, { timestamps: false });
  return { slug: v.slug, type: v.type };
}

export async function setDevotionalPublishState(id: string, input: PublishInput) {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Item not found");
  await connectDB();
  for (let attempt = 0; attempt < 5; attempt++) {
    const cur = await Devotional.findById(id).select("status publishAt publishedAt lyrics reviewer reviewedAt").lean();
    if (!cur) throw new ApiError("NOT_FOUND", "Item not found");
    if (input.action !== "unpublish") {
      const problems = publishProblems(cur);
      if (Object.keys(problems).length) throw new ApiError("VALIDATION_ERROR", Object.values(problems)[0], problems);
    }
    const now = new Date();
    let update: Record<string, unknown>;
    if (input.action === "publish") {
      const keep = isLive(cur, now) && cur.publishedAt ? cur.publishedAt : now;
      update = { $set: { status: "published", publishedAt: keep }, $unset: { publishAt: 1 } };
    } else if (input.action === "unpublish") update = { $set: { status: "draft" }, $unset: { publishAt: 1, publishedAt: 1 } };
    else { const at = new Date(input.publishAt); update = { $set: { status: "scheduled", publishAt: at, publishedAt: at } }; }
    const v = await Devotional.findOneAndUpdate({ _id: id, status: cur.status, publishAt: cur.publishAt ?? null, publishedAt: cur.publishedAt ?? null }, update, { returnDocument: "after" }).lean();
    if (v) return toAdmin(v);
  }
  throw new ApiError("CONFLICT", "This item is being changed right now. Try again.");
}

export async function rotateDevotionalPreviewToken(id: string) {
  if (!isId(id)) throw new ApiError("NOT_FOUND", "Item not found");
  await connectDB();
  const v = await Devotional.findByIdAndUpdate(id, { $set: { previewToken: newToken() } }, { returnDocument: "after", timestamps: false }).lean();
  if (!v) throw new ApiError("NOT_FOUND", "Item not found");
  return toAdmin(v);
}

/** Items whose recording is expired, withdrawn or expires within 30 days: the admin list highlights these. */
export async function countAudioNeedingAttention(now = new Date()) {
  await connectDB();
  const soon = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
  return Devotional.countDocuments({ audioUrl: { $ne: "" }, $or: [{ "rights.withdrawn": true }, { "rights.expiresAt": { $lte: soon, $ne: null } }] });
}

// ---------- public ----------
export type DevotionalCard = {
  id: string; slug: string; type: DevotionalType; typeLabel: string; title: string; deity: string; language: DevotionalLanguage; languageLabel: string;
  excerpt: string; cover: { url: string; alt: string } | null; hasAudio: boolean;
};
export type PublicAudio = { url: string; durationSeconds: number | null; credit: string };
export type PublicDevotional = DevotionalCard & {
  lyrics: string; transliteration: string; meaningHtml: string; summary: string;
  /** Present only while the recording's rights are valid. Checked when the page is built (the storefront cache is at most 60 s old). */
  audio: PublicAudio | null;
  related: DevotionalCard[]; relatedVidhi: { slug: string; title: string }[]; relatedProducts: PublicProduct[];
  tags: string[]; reviewer: string; reviewedAt: string | null; publishedAt: string | null; updatedAt: string; seo: AdminDevotional["seo"];
};

type CardSource = Pick<DevotionalDoc, "_id" | "slug" | "type" | "title" | "deity" | "language" | "summary" | "lyrics" | "coverImageUrl" | "coverImageAlt" | "audioUrl" | "rights">;
const CARD_FIELDS = "slug type title deity language summary lyrics coverImageUrl coverImageAlt audioUrl rights";
const toCard = (v: CardSource, now: Date): DevotionalCard => ({
  id: String(v._id), slug: v.slug, type: v.type, typeLabel: devotionalTypeLabel(v.type), title: v.title, deity: v.deity ?? "", language: v.language, languageLabel: devotionalLanguageLabel(v.language),
  excerpt: v.summary ? plainExcerpt(v.summary) : plainExcerpt(v.lyrics ?? "", 120),
  cover: v.coverImageUrl ? { url: v.coverImageUrl, alt: v.coverImageAlt ?? "" } : null,
  hasAudio: audioPlayable(audioStatus(v.audioUrl, v.rights, now)),
});

async function toPublic(v: DevotionalDoc, now: Date): Promise<PublicDevotional> {
  const [related, vidhi, products] = await Promise.all([
    v.relatedAarti?.length ? Devotional.find({ slug: { $in: v.relatedAarti }, ...liveFilter(now) }).select(CARD_FIELDS).lean() : Promise.resolve([]),
    v.relatedVidhi?.length ? Vidhi.find({ slug: { $in: v.relatedVidhi }, ...liveFilter(now) }).select("slug title").lean() : Promise.resolve([]),
    v.relatedProducts?.length ? findCards({ slugs: v.relatedProducts }) : Promise.resolve([] as PublicProduct[]),
  ]);
  const relBy = new Map(related.map((r) => [r.slug, r])), vidBy = new Map(vidhi.map((r) => [r.slug, r])), prodBy = new Map(products.map((p) => [p.slug, p]));
  const playable = audioPlayable(audioStatus(v.audioUrl, v.rights, now));
  return {
    ...toCard(v, now), lyrics: v.lyrics ?? "", transliteration: v.transliteration ?? "", meaningHtml: renderMarkdown(v.meaning ?? ""), summary: v.summary ?? "",
    audio: playable ? { url: v.audioUrl, durationSeconds: v.audioDurationSeconds ?? null, credit: v.rights.source } : null,
    related: (v.relatedAarti ?? []).map((s) => relBy.get(s)).filter((r): r is NonNullable<typeof r> => !!r).map((r) => toCard(r, now)),
    relatedVidhi: (v.relatedVidhi ?? []).map((s) => vidBy.get(s)).filter((r): r is NonNullable<typeof r> => !!r).map((r) => ({ slug: r.slug, title: r.title })),
    relatedProducts: (v.relatedProducts ?? []).map((s) => prodBy.get(s)).filter((p): p is PublicProduct => !!p),
    tags: v.tags ?? [], reviewer: v.reviewer ?? "", reviewedAt: iso(v.reviewedAt), publishedAt: iso(v.publishedAt), updatedAt: v.updatedAt.toISOString(),
    seo: { title: v.seo?.title ?? "", description: v.seo?.description ?? "", canonical: v.seo?.canonical ?? "", ogImage: v.seo?.ogImage ?? "", noindex: !!v.seo?.noindex },
  };
}

/** `types` limits to the item kinds a URL prefix serves (/aarti = aarti only, /mantras = everything else). */
export async function findPublicDevotional(slug: string, types: readonly DevotionalType[], now = new Date()): Promise<PublicDevotional | null> {
  await connectDB();
  const v = await Devotional.findOne({ slug, type: { $in: types }, ...liveFilter(now) }).lean();
  return v ? toPublic(v, now) : null;
}

export async function findPreviewDevotional(token: string, now = new Date()): Promise<PublicDevotional | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  await connectDB();
  const v = await Devotional.findOne({ previewToken: token }).lean();
  return v ? toPublic(v, now) : null;
}

export type PublicListQuery = { types: readonly DevotionalType[]; type?: DevotionalType; deity?: string; language?: DevotionalLanguage; q?: string; page?: number; limit?: number };
export async function findPublicDevotionalList({ types, type, deity, language, q, page = 1, limit = 12 }: PublicListQuery, now = new Date()) {
  await connectDB();
  const base = { ...liveFilter(now), type: { $in: types } };
  const filter: Record<string, unknown> = { ...base };
  if (type && types.includes(type)) filter.type = type;
  if (deity) filter.deity = new RegExp(`^${escapeRegex(deity)}$`, "i");
  if (language) filter.language = language;
  if (q) { const rx = new RegExp(escapeRegex(q), "i"); filter.$and = [{ $or: [{ title: rx }, { deity: rx }, { tags: rx }, { summary: rx }] }]; }
  const [rows, total, typeCounts, deities, languages] = await Promise.all([
    Devotional.find(filter).select(CARD_FIELDS).sort({ publishedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Devotional.countDocuments(filter),
    Devotional.aggregate<{ _id: DevotionalType; n: number }>([{ $match: base }, { $group: { _id: "$type", n: { $sum: 1 } } }]),
    Devotional.distinct("deity", base),
    Devotional.distinct("language", base),
  ]);
  return {
    items: rows.map((r) => toCard(r, now)), total, page, limit, pages: Math.max(1, Math.ceil(total / limit)),
    typeCounts: Object.fromEntries(typeCounts.map((c) => [c._id, c.n])) as Partial<Record<DevotionalType, number>>,
    deities: (deities as string[]).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    languages: (languages as DevotionalLanguage[]).filter(Boolean),
  };
}

export async function findDevotionalForSitemap(now = new Date()) {
  await connectDB();
  return Devotional.find({ ...liveFilter(now), "seo.noindex": { $ne: true } }).select("slug type updatedAt").sort({ updatedAt: -1 }).limit(5000).lean();
}

/** Does a live item of one of these types exist? (Used by the proxy to give real 404s.) */
export async function devotionalExists(slug: string, types: readonly DevotionalType[], now = new Date()) {
  await connectDB();
  return !!(await Devotional.exists({ slug, type: { $in: types }, ...liveFilter(now) }));
}

/** Live aarti slugs among `slugs` (Pooja Vidhi pages use this for "Related aarti"). */
export async function findLiveDevotionalCards(slugs: string[], now = new Date()): Promise<DevotionalCard[]> {
  if (!slugs.length) return [];
  await connectDB();
  const rows = await Devotional.find({ slug: { $in: slugs }, ...liveFilter(now) }).select(CARD_FIELDS).lean();
  const by = new Map(rows.map((r) => [r.slug, r]));
  return slugs.map((s) => by.get(s)).filter((r): r is NonNullable<typeof r> => !!r).map((r) => toCard(r, now));
}
export { MANTRA_TYPE_KEYS };
