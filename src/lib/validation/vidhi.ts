import { z } from "zod";
import { optionalUrl, publishSchema, seoSchema } from "./pages";

/** PRD v1.1 §8: daily pooja, festival pooja, special pooja, vrat/katha and step-by-step guides. */
export const VIDHI_CATEGORIES = [
  { key: "daily", label: "Daily pooja" },
  { key: "festival", label: "Festival pooja" },
  { key: "special", label: "Special pooja" },
  { key: "vrat-katha", label: "Vrat & katha" },
  { key: "step-by-step", label: "Step-by-step guide" },
] as const;
export type VidhiCategory = (typeof VIDHI_CATEGORIES)[number]["key"];
export const VIDHI_CATEGORY_KEYS = VIDHI_CATEGORIES.map((c) => c.key) as [VidhiCategory, ...VidhiCategory[]];
export const vidhiCategoryLabel = (k: string) => VIDHI_CATEGORIES.find((c) => c.key === k)?.label ?? k;

/** Public path of a guide. Guides live under /pooja-vidhi/ so their slugs never collide with CMS pages. */
export const VIDHI_BASE = "/pooja-vidhi";
export const vidhiHref = (slug: string) => `${VIDHI_BASE}/${slug}`;

const slugPart = z.string().trim().toLowerCase().min(1, "Enter a slug").max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single dashes");
/** A reference to another record by slug; "" = not set. */
const refSlug = z.string().trim().toLowerCase().max(80).refine((v) => v === "" || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v), "Use a slug like brass-diya");
const unique = (a: string[]) => [...new Set(a.filter(Boolean))];

const samagriItem = z.object({
  item: z.string().trim().min(1, "Name the item").max(100),
  quantity: z.string().trim().max(60).default(""),
  note: z.string().trim().max(200).default(""),
  /** Product slug in the shop: shown as a "Buy" link when the product is available. */
  productSlug: refSlug.default(""),
});
const step = z.object({
  title: z.string().trim().max(120).default(""),
  body: z.string().trim().min(1, "Describe this step").max(4000),
  mantra: z.string().trim().max(1000).default(""),
});
const mantra = z.object({
  title: z.string().trim().min(1, "Give the mantra a name").max(120),
  text: z.string().trim().min(1, "Enter the mantra").max(2000),
  meaning: z.string().trim().max(2000).default(""),
});

const vidhiFields = z.object({
  title: z.string().trim().min(2, "Enter a title").max(120),
  slug: slugPart,
  category: z.enum(VIDHI_CATEGORY_KEYS),
  deity: z.string().trim().max(60).default(""),
  /** Introduction (Markdown). */
  summary: z.string().trim().max(2000).default(""),
  significance: z.string().trim().max(5000).default(""),
  samagri: z.array(samagriItem).max(60).default([]),
  preparation: z.string().trim().max(5000).default(""),
  steps: z.array(step).max(40).default([]),
  mantras: z.array(mantra).max(20).default([]),
  /** Anything else (Markdown): also where guides migrated from the old Guides section land. */
  body: z.string().trim().max(20_000).default(""),
  relatedAarti: z.array(refSlug).max(8).default([]).transform(unique),
  relatedProducts: z.array(refSlug).max(8).default([]).transform(unique),
  relatedVidhi: z.array(refSlug).max(6).default([]).transform(unique),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(30)).max(12).default([]).transform(unique),
  durationMinutes: z.number().int().min(1).max(1440).nullish().transform((v) => v ?? null),
  coverImageUrl: optionalUrl.default(""),
  coverImageAlt: z.string().trim().max(200).default(""),
  author: z.string().trim().max(80).default(""),
  reviewer: z.string().trim().max(80).default(""),
  /** Date the content was last checked for accuracy ("" = not reviewed). */
  reviewedAt: z.union([z.literal(""), z.iso.datetime({ offset: true })]).default(""),
  seo: seoSchema,
}).superRefine((v, ctx) => {
  if (v.coverImageUrl && !v.coverImageAlt) ctx.addIssue({ code: "custom", path: ["coverImageAlt"], message: "Describe the image for accessibility" });
  if (v.reviewedAt && !v.reviewer) ctx.addIssue({ code: "custom", path: ["reviewer"], message: "Who reviewed it?" });
  if (v.reviewer && !v.reviewedAt) ctx.addIssue({ code: "custom", path: ["reviewedAt"], message: "When was it reviewed?" });
  if (v.relatedVidhi.includes(v.slug)) ctx.addIssue({ code: "custom", path: ["relatedVidhi"], message: "A guide cannot relate to itself" });
});

export const vidhiInputSchema = vidhiFields;
export const updateVidhiSchema = z.object({ baseUpdatedAt: z.iso.datetime({ offset: true }) }).and(vidhiFields);
export const vidhiPublishSchema = publishSchema;
export const listVidhiSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["draft", "published", "scheduled"]).optional(),
  category: z.enum(VIDHI_CATEGORY_KEYS).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export const publicVidhiSchema = z.object({
  category: z.enum(VIDHI_CATEGORY_KEYS).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export type VidhiInput = z.infer<typeof vidhiInputSchema>;
export type UpdateVidhiInput = z.infer<typeof updateVidhiSchema>;
export type ListVidhiInput = z.infer<typeof listVidhiSchema>;
export type PublicVidhiInput = z.infer<typeof publicVidhiSchema>;

export const emptyVidhi: VidhiInput = {
  title: "", slug: "", category: "daily", deity: "", summary: "", significance: "", samagri: [], preparation: "", steps: [], mantras: [], body: "",
  relatedAarti: [], relatedProducts: [], relatedVidhi: [], tags: [], durationMinutes: null, coverImageUrl: "", coverImageAlt: "", author: "", reviewer: "", reviewedAt: "",
  seo: { title: "", description: "", canonical: "", ogImage: "", noindex: false },
};
