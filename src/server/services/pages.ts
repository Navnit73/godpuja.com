import crypto from "node:crypto";
import mongoose from "mongoose";
import { ApiError } from "../api";
import { connectDB } from "../db";
import { Page, type PageDoc } from "../models/Page";
import { renderMarkdown } from "../markdown";
import { clearRedirectsFrom, dropRedirectsTo, recordRedirects } from "./redirects";

const pagePath = (slug: string) => (slug === "home" ? "/" : `/${slug}`);
import type { ListPagesInput, PageInput, PageKind, PublishInput } from "@/lib/validation/pages";

export type PageStatus = "draft" | "published" | "scheduled";

export type AdminPage = {
  id: string;
  kind: PageKind;
  title: string;
  slug: string;
  description: string;
  coverImageUrl: string;
  coverImageAlt: string;
  status: PageStatus;
  publishAt: string | null;
  publishedAt: string | null;
  previewToken: string;
  sections: PageInput["sections"];
  seo: PageInput["seo"];
  createdAt: string;
  updatedAt: string;
};

export type PageListItem = Pick<AdminPage, "id" | "kind" | "title" | "slug" | "status" | "publishAt" | "updatedAt"> & { live: boolean };

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const newToken = () => crypto.randomBytes(24).toString("base64url");
const iso = (d?: Date | null) => (d ? d.toISOString() : null);

/** A page is publicly visible if published, or scheduled with a publish time that has passed. */
export const isLive = (p: { status: PageStatus; publishAt?: Date | null }, now = new Date()) =>
  p.status === "published" || (p.status === "scheduled" && !!p.publishAt && p.publishAt <= now);

/** Documents saved before `kind` existed have no field; they are plain pages. */
export const kindFilter = (kind: PageKind): mongoose.QueryFilter<PageDoc> => (kind === "page" ? { kind: { $in: ["page", null] } } : { kind });
const kindOf = (k: unknown): PageKind => (k === "blog" || k === "guide" ? k : "page");

const liveFilter = (now: Date): mongoose.QueryFilter<PageDoc> => ({
  $or: [{ status: "published" as const }, { status: "scheduled" as const, publishAt: { $lte: now } }],
});

function toAdmin(p: PageDoc): AdminPage {
  return {
    id: String(p._id),
    kind: kindOf(p.kind),
    title: p.title,
    slug: p.slug,
    description: p.description ?? "",
    coverImageUrl: p.coverImageUrl ?? "",
    coverImageAlt: p.coverImageAlt ?? "",
    status: p.status,
    publishAt: iso(p.publishAt),
    publishedAt: iso(p.publishedAt),
    previewToken: p.previewToken,
    sections: (p.sections ?? []) as PageInput["sections"],
    seo: { title: p.seo?.title ?? "", description: p.seo?.description ?? "", canonical: p.seo?.canonical ?? "", ogImage: p.seo?.ogImage ?? "", noindex: !!p.seo?.noindex },
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function dupSlug(err: unknown): never {
  if ((err as { code?: number }).code === 11000) {
    throw new ApiError("CONFLICT", "A page with this URL already exists", { slug: "Already in use" });
  }
  throw err;
}

export async function listPages({ q, status, kind, page, limit }: ListPagesInput) {
  await connectDB();
  const filter: Record<string, unknown> = kind ? { ...kindFilter(kind) } : {};
  if (status) filter.status = status;
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ title: rx }, { slug: rx }];
  }
  const now = new Date();
  const [rows, total] = await Promise.all([
    Page.find(filter).select("kind title slug status publishAt updatedAt").sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Page.countDocuments(filter),
  ]);
  const items: PageListItem[] = rows.map((p) => ({
    id: String(p._id), kind: kindOf(p.kind), title: p.title, slug: p.slug, status: p.status, publishAt: iso(p.publishAt),
    updatedAt: p.updatedAt.toISOString(), live: isLive(p, now),
  }));
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getPage(id: string): Promise<AdminPage> {
  if (!mongoose.isValidObjectId(id)) throw new ApiError("NOT_FOUND", "Page not found");
  await connectDB();
  const p = await Page.findById(id).lean();
  if (!p) throw new ApiError("NOT_FOUND", "Page not found");
  return toAdmin(p);
}

const normalise = (i: PageInput) => ({
  kind: i.kind ?? "page",
  title: i.title,
  slug: i.slug,
  description: i.description,
  coverImageUrl: i.coverImageUrl ?? "",
  coverImageAlt: i.coverImageUrl ? (i.coverImageAlt ?? "") : "",
  sections: i.sections.map((s) => ({ ...s, data: { ...s.data } })),
  seo: { ...i.seo },
});

/** New pages are always drafts. */
export async function createPage(input: PageInput) {
  await connectDB();
  try {
    const p = await Page.create({ ...normalise(input), status: "draft", previewToken: newToken() });
    await clearRedirectsFrom([pagePath(p.slug)]); // the URL is a real page again
    return toAdmin(p.toObject() as PageDoc);
  } catch (err) {
    return dupSlug(err);
  }
}

/**
 * Content edit only; publishing state is changed via setPublishState. `baseUpdatedAt` is the version the editor
 * loaded: if the page changed since, the save is rejected (409) instead of silently overwriting someone else.
 * Returns the previous slug for cache invalidation.
 */
export async function updatePage(id: string, input: PageInput, baseUpdatedAt: string) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError("NOT_FOUND", "Page not found");
  await connectDB();
  let prev: { slug: string } | null;
  try {
    prev = await Page.findOneAndUpdate(
      { _id: id, updatedAt: new Date(baseUpdatedAt) },
      { $set: normalise(input) },
      { returnDocument: "before" },
    ).select("slug").lean();
  } catch (err) {
    return dupSlug(err);
  }
  if (!prev) {
    const exists = await Page.exists({ _id: id });
    if (!exists) throw new ApiError("NOT_FOUND", "Page not found");
    throw new ApiError("CONFLICT", "This page was changed by someone else. Reload to see their changes before saving.");
  }
  if (prev.slug !== input.slug) {
    // Old links keep working: 301 from the old URL (the proxy serves it), and the new URL is never a redirect source.
    await clearRedirectsFrom([pagePath(input.slug)]);
    if (prev.slug !== "home") await recordRedirects([{ from: pagePath(prev.slug), to: pagePath(input.slug) }]);
  }
  return { page: await getPage(id), previousSlug: prev.slug };
}

export async function deletePage(id: string) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError("NOT_FOUND", "Page not found");
  await connectDB();
  const p = await Page.findByIdAndDelete(id).select("slug").lean();
  if (!p) throw new ApiError("NOT_FOUND", "Page not found");
  await dropRedirectsTo([pagePath(p.slug)]);
  return { slug: p.slug };
}

export async function setPublishState(id: string, input: PublishInput) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError("NOT_FOUND", "Page not found");
  await connectDB();
  const now = new Date();
  let update: Record<string, unknown>;
  if (input.action === "publish") {
    update = { $set: { status: "published", publishedAt: now }, $unset: { publishAt: 1 } };
  } else if (input.action === "unpublish") {
    update = { $set: { status: "draft" }, $unset: { publishAt: 1, publishedAt: 1 } };
  } else {
    const at = new Date(input.publishAt);
    update = { $set: { status: "scheduled", publishAt: at, publishedAt: at } }; // publishedAt = when it goes live
  }
  const p = await Page.findByIdAndUpdate(id, update, { returnDocument: "after" }).lean();
  if (!p) throw new ApiError("NOT_FOUND", "Page not found");
  return toAdmin(p);
}

/** Invalidate the old preview link and issue a new one. */
export async function rotatePreviewToken(id: string) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError("NOT_FOUND", "Page not found");
  await connectDB();
  const p = await Page.findByIdAndUpdate(id, { $set: { previewToken: newToken() } }, { returnDocument: "after" }).lean();
  if (!p) throw new ApiError("NOT_FOUND", "Page not found");
  return toAdmin(p); // full page: rotating bumps updatedAt, so the editor needs the new version
}

// ---------- Public (storefront) reads ----------

export type PublicSection =
  | { id: string; type: "richtext"; html: string }
  | {
      id: string; type: "imageText"; heading: string; bodyHtml: string; imageUrl: string; imageAlt: string;
      imagePosition: "left" | "right"; ctaLabel: string; ctaUrl: string;
    };

export type PublicPage = {
  kind: PageKind;
  title: string;
  slug: string;
  description: string;
  coverImageUrl: string;
  coverImageAlt: string;
  /** When it went (or goes) live; null for drafts seen via preview. */
  publishedAt: string | null;
  sections: PublicSection[];
  seo: PageInput["seo"];
  isPreview: boolean;
};

function toPublic(p: PageDoc, isPreview: boolean): PublicPage {
  const sections: PublicSection[] = [];
  for (const s of p.sections ?? []) {
    if (!s.enabled) continue;
    const d = (s.data ?? {}) as Record<string, string>;
    if (s.type === "richtext") sections.push({ id: s.id, type: "richtext", html: renderMarkdown(d.markdown ?? "") });
    else if (s.type === "imageText") {
      sections.push({
        id: s.id, type: "imageText", heading: d.heading ?? "", bodyHtml: renderMarkdown(d.markdown ?? ""),
        imageUrl: d.imageUrl ?? "", imageAlt: d.imageAlt ?? "", imagePosition: d.imagePosition === "right" ? "right" : "left",
        ctaLabel: d.ctaLabel ?? "", ctaUrl: d.ctaUrl ?? "",
      });
    }
  }
  const seo = toAdmin(p).seo;
  return {
    kind: kindOf(p.kind), title: p.title, slug: p.slug, description: p.description ?? "", coverImageUrl: p.coverImageUrl ?? "",
    coverImageAlt: p.coverImageAlt ?? "", publishedAt: iso(p.publishedAt), sections, seo, isPreview,
  };
}

export async function findPublicPage(slug: string, now = new Date()): Promise<PublicPage | null> {
  await connectDB();
  const p = await Page.findOne({ slug, ...liveFilter(now) }).lean();
  return p ? toPublic(p, false) : null;
}

export async function findPreviewPage(token: string): Promise<PublicPage | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  await connectDB();
  const p = await Page.findOne({ previewToken: token }).lean();
  return p ? toPublic(p, true) : null;
}


/** Card data for blog / guide listings (index pages and the homepage "Latest posts" section). */
export type PostCard = {
  id: string; kind: Exclude<PageKind, "page">; title: string; slug: string; excerpt: string;
  coverImageUrl: string; coverImageAlt: string; publishedAt: string | null;
};

/** Live posts of one kind (or both), newest first. `page` is 1-based. */
export async function findPublicPosts(kind: Exclude<PageKind, "page"> | "all", { page = 1, limit = 12 } = {}, now = new Date()) {
  await connectDB();
  const filter: mongoose.QueryFilter<PageDoc> = { ...(kind === "all" ? { kind: { $in: ["blog", "guide"] } } : { kind }), ...liveFilter(now) };
  const [rows, total] = await Promise.all([
    Page.find(filter).select("kind title slug description coverImageUrl coverImageAlt publishedAt")
      .sort({ publishedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Page.countDocuments(filter),
  ]);
  const items: PostCard[] = rows.map((p) => ({
    id: String(p._id), kind: p.kind === "guide" ? "guide" : "blog", title: p.title, slug: p.slug, excerpt: p.description ?? "",
    coverImageUrl: p.coverImageUrl ?? "", coverImageAlt: p.coverImageAlt ?? "", publishedAt: iso(p.publishedAt),
  }));
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}
