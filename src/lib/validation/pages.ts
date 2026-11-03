import { z } from "zod";
import { validateSlug } from "@/lib/slug";

// "" is allowed for optional fields (empty form inputs); services normalise "" to undefined.
export const httpUrl = z.url({ protocol: /^https?$/, message: "Enter a full http(s) URL" }).max(2000);
const isHttp = (v: string) => z.url({ protocol: /^https?$/ }).safeParse(v).success;
const isPath = (v: string) => /^\/(?!\/)[^\s\\]*$/.test(v);
/** One schema (not a union) so the editor shows a helpful message instead of "Invalid input". "" = not set. */
export const optionalUrl = z.string().max(2000).refine((v) => v === "" || isHttp(v), "Enter a full http(s) URL, or leave empty");
/** Internal path ("/about") or absolute http(s) URL; "" = not set. */
export const linkUrl = z.string().max(2000).refine((v) => v === "" || isHttp(v) || isPath(v), "Use a path like /about or a full https:// URL");

export const sectionSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1).max(40),
    type: z.literal("richtext"),
    enabled: z.boolean(),
    data: z.object({ markdown: z.string().max(50_000) }),
  }),
  z.object({
    id: z.string().min(1).max(40),
    type: z.literal("imageText"),
    enabled: z.boolean(),
    data: z
      .object({
        heading: z.string().trim().max(120),
        markdown: z.string().max(5_000),
        imageUrl: optionalUrl,
        imageAlt: z.string().trim().max(200),
        imagePosition: z.enum(["left", "right"]),
        ctaLabel: z.string().trim().max(40),
        ctaUrl: linkUrl,
      })
      .refine((d) => !d.imageUrl || d.imageAlt.length > 0, { path: ["imageAlt"], message: "Describe the image for accessibility" })
      .refine((d) => !d.ctaLabel || d.ctaUrl.length > 0, { path: ["ctaUrl"], message: "Add a link for the button" }),
  }),
]);

export const seoSchema = z.object({
  title: z.string().trim().max(70, "Keep under 70 characters"),
  description: z.string().trim().max(200, "Keep under 200 characters"),
  canonical: optionalUrl,
  ogImage: optionalUrl,
  noindex: z.boolean(),
});

/**
 * Content kinds share one model and editor. Blog posts and guides live under a fixed URL prefix
 * (/blog/…, /guides/…) whose index pages list them; plain pages may not use those prefixes.
 */
export const PAGE_KINDS = ["page", "blog", "guide"] as const;
export type PageKind = (typeof PAGE_KINDS)[number];
export const KIND_META: Record<PageKind, { label: string; plural: string; prefix: string; admin: string }> = {
  page: { label: "Page", plural: "Pages", prefix: "", admin: "/admin/pages" },
  blog: { label: "Blog post", plural: "Blog", prefix: "blog", admin: "/admin/blog" },
  guide: { label: "Guide", plural: "Guides", prefix: "guides", admin: "/admin/guides" },
};
export const kindOfPrefix = (first: string): PageKind | null => (first === "blog" ? "blog" : first === "guides" ? "guide" : null);

const pageFields = z.object({
  /** Optional for backwards compatibility; missing means "page". */
  kind: z.enum(PAGE_KINDS).optional(),
  title: z.string().trim().min(2, "Enter a title").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter a URL slug")
    .max(200)
    .superRefine((v, ctx) => {
      const msg = validateSlug(v);
      if (msg) ctx.addIssue({ code: "custom", message: msg });
    }),
  description: z.string().trim().max(300),
  /** Card / header image for blog posts and guides. "" = none. */
  coverImageUrl: optionalUrl.optional(),
  coverImageAlt: z.string().trim().max(200).optional(),
  sections: z
    .array(sectionSchema)
    .max(50, "At most 50 sections")
    .refine((a) => new Set(a.map((s) => s.id)).size === a.length, "Section ids must be unique"),
  seo: seoSchema,
});

function checkKind(v: z.infer<typeof pageFields>, ctx: z.RefinementCtx) {
  const kind = v.kind ?? "page";
  const first = v.slug.split("/")[0];
  const prefix = KIND_META[kind].prefix;
  if (prefix && (first !== prefix || !v.slug.includes("/"))) {
    ctx.addIssue({ code: "custom", path: ["slug"], message: `${KIND_META[kind].label} URLs start with ${prefix}/, e.g. ${prefix}/my-title` });
  } else if (!prefix && kindOfPrefix(first)) {
    ctx.addIssue({ code: "custom", path: ["slug"], message: `"${first}" is used for ${KIND_META[kindOfPrefix(first)!].plural.toLowerCase()}; choose another URL` });
  }
  if (v.coverImageUrl && !v.coverImageAlt) ctx.addIssue({ code: "custom", path: ["coverImageAlt"], message: "Describe the image for accessibility" });
}

export const pageInputSchema = pageFields.superRefine(checkKind);

/** Edits carry the `updatedAt` the editor loaded, so concurrent saves are detected (optimistic concurrency). */
export const updatePageSchema = pageFields.extend({ baseUpdatedAt: z.iso.datetime({ offset: true }) }).superRefine(checkKind);

export const publishSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("publish") }),
  z.object({ action: z.literal("unpublish") }),
  z.object({
    action: z.literal("schedule"),
    publishAt: z.iso.datetime({ offset: true }).refine((v) => new Date(v).getTime() > Date.now(), "Choose a future date and time"),
  }),
]);

export const listPagesSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["draft", "published", "scheduled"]).optional(),
  kind: z.enum(PAGE_KINDS).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type PageInput = z.infer<typeof pageInputSchema>;
export type SectionInput = z.infer<typeof sectionSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;
export type PublishInput = z.infer<typeof publishSchema>;
export type ListPagesInput = z.infer<typeof listPagesSchema>;
export const emptySeo: PageInput["seo"] = { title: "", description: "", canonical: "", ogImage: "", noindex: false };
