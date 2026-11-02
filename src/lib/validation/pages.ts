import { z } from "zod";
import { validateSlug } from "@/lib/slug";

// "" is allowed for optional fields (empty form inputs); services normalise "" to undefined.
export const httpUrl = z.url({ protocol: /^https?$/, message: "Enter a full http(s) URL" });
export const optionalUrl = z.union([z.literal(""), httpUrl]);
/** Internal path ("/about") or absolute http(s) URL. */
export const linkUrl = z.union([
  z.literal(""),
  httpUrl,
  z.string().regex(/^\/(?!\/)[^\s\\]*$/, "Use a path like /about or a full URL"),
]);

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

export const pageInputSchema = z.object({
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
  sections: z
    .array(sectionSchema)
    .max(50, "At most 50 sections")
    .refine((a) => new Set(a.map((s) => s.id)).size === a.length, "Section ids must be unique"),
  seo: seoSchema,
});

/** Edits carry the `updatedAt` the editor loaded, so concurrent saves are detected (optimistic concurrency). */
export const updatePageSchema = pageInputSchema.extend({ baseUpdatedAt: z.iso.datetime({ offset: true }) });

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
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type PageInput = z.infer<typeof pageInputSchema>;
export type SectionInput = z.infer<typeof sectionSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;
export type PublishInput = z.infer<typeof publishSchema>;
export type ListPagesInput = z.infer<typeof listPagesSchema>;
export const emptySeo: PageInput["seo"] = { title: "", description: "", canonical: "", ogImage: "", noindex: false };
