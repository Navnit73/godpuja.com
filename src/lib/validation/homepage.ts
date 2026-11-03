import { z } from "zod";
import { linkUrl, optionalUrl } from "./pages";

export const SECTION_TYPES = ["hero", "banner", "featuredCategories", "featuredProducts", "latestProducts", "bestSellers", "richText", "imageText", "testimonials", "offer", "custom", "latestPosts"] as const;
export type SectionType = (typeof SECTION_TYPES)[number];
export const MAX_SECTIONS = 30;
export const MAX_RAILS = 6; // each product rail is one indexed query

const id = z.string().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/, "Invalid id");
const text = (max: number) => z.string().trim().max(max);
const link = linkUrl;
const objectId = z.string().regex(/^[a-f0-9]{24}$/, "Invalid id");
const categoryPath = z.union([z.literal(""), z.string().trim().max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*){0,2}$/, "Use a category URL like puja-kits/diwali")]);

const needAlt = <T extends { imageUrl: string; imageAlt: string }>(d: T) => !d.imageUrl || d.imageAlt.length > 0;
const altMsg = { path: ["imageAlt"], message: "Describe the image for accessibility" };
const needLabelLink = <T extends Record<string, string>>(label: keyof T, url: keyof T) => (d: T) => !d[label] || !!d[url];

const rail = z.object({ heading: text(80), category: categoryPath, limit: z.number().int().min(1).max(12) });

const base = { id, enabled: z.boolean() };
export const homeSectionSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("hero"), data: z.object({
    heading: text(120).min(1, "Enter a heading"), subheading: text(300), imageUrl: optionalUrl, imageAlt: text(200),
    ctaLabel: text(40), ctaUrl: link, secondaryCtaLabel: text(40), secondaryCtaUrl: link,
  }).refine(needAlt, altMsg).refine(needLabelLink<Record<string, string>>("ctaLabel", "ctaUrl"), { path: ["ctaUrl"], message: "Add a link for the button" })
    .refine(needLabelLink<Record<string, string>>("secondaryCtaLabel", "secondaryCtaUrl"), { path: ["secondaryCtaUrl"], message: "Add a link for the button" }) }),
  z.object({ ...base, type: z.literal("banner"), data: z.object({
    items: z.array(z.object({ imageUrl: z.url({ protocol: /^https?$/, message: "Enter a full http(s) image URL" }).max(2000), imageAlt: text(200).min(1, "Describe the image"), heading: text(100), text: text(200), linkUrl: link })).min(1, "Add at least one banner").max(4, "At most 4 banners"),
  }) }),
  z.object({ ...base, type: z.literal("featuredCategories"), data: z.object({
    heading: text(80), categoryIds: z.array(objectId).min(1, "Choose at least one category").max(8, "At most 8 categories"),
  }).refine((d) => new Set(d.categoryIds).size === d.categoryIds.length, { path: ["categoryIds"], message: "Each category once" }) }),
  z.object({ ...base, type: z.literal("featuredProducts"), data: rail }),
  z.object({ ...base, type: z.literal("latestProducts"), data: rail }),
  z.object({ ...base, type: z.literal("bestSellers"), data: rail }),
  z.object({ ...base, type: z.literal("richText"), data: z.object({ markdown: z.string().max(20_000) }) }),
  z.object({ ...base, type: z.literal("imageText"), data: z.object({
    heading: text(120), markdown: z.string().max(5_000), imageUrl: optionalUrl, imageAlt: text(200), imagePosition: z.enum(["left", "right"]), ctaLabel: text(40), ctaUrl: link,
  }).refine(needAlt, altMsg).refine(needLabelLink<Record<string, string>>("ctaLabel", "ctaUrl"), { path: ["ctaUrl"], message: "Add a link for the button" })
    .refine((d) => !!(d.heading || d.markdown.trim() || d.imageUrl), { path: ["heading"], message: "Add a heading, text or an image" }) }),
  z.object({ ...base, type: z.literal("testimonials"), data: z.object({
    heading: text(80), items: z.array(z.object({ quote: text(400).min(1, "Enter the quote"), author: text(80).min(1, "Enter a name"), role: text(80) })).min(1, "Add at least one testimonial").max(8, "At most 8 testimonials"),
  }) }),
  z.object({ ...base, type: z.literal("offer"), data: z.object({
    heading: text(100).min(1, "Enter a heading"), text: text(300), code: text(30), ctaLabel: text(40), ctaUrl: link,
    expiresAt: z.union([z.literal(""), z.iso.datetime({ offset: true })]),
  }).refine(needLabelLink<Record<string, string>>("ctaLabel", "ctaUrl"), { path: ["ctaUrl"], message: "Add a link for the button" }) }),
  z.object({ ...base, type: z.literal("custom"), data: z.object({ markdown: z.string().max(20_000), tone: z.enum(["plain", "soft", "accent"]) }) }),
  z.object({ ...base, type: z.literal("latestPosts"), data: z.object({ heading: text(80), kind: z.enum(["blog", "guide", "all"]), limit: z.number().int().min(1).max(12) }) }),
]);

export const homepageInputSchema = z.object({
  sections: z.array(homeSectionSchema).max(MAX_SECTIONS, `At most ${MAX_SECTIONS} sections`)
    .refine((a) => new Set(a.map((s) => s.id)).size === a.length, "Section ids must be unique")
    .refine((a) => a.filter((s) => s.type === "hero").length <= 1, "Only one hero section (it holds the page's main heading)")
    .refine((a) => a.filter((s) => ["featuredProducts", "latestProducts", "bestSellers"].includes(s.type)).length <= MAX_RAILS, `At most ${MAX_RAILS} product sections`),
});
/** `baseUpdatedAt` is null only for the very first save. */
export const updateHomepageSchema = homepageInputSchema.extend({ baseUpdatedAt: z.iso.datetime({ offset: true }).nullable() });

export type HomeSection = z.infer<typeof homeSectionSchema>;
export type HomepageInput = z.infer<typeof homepageInputSchema>;
export type UpdateHomepageInput = z.infer<typeof updateHomepageSchema>;

type Data<T extends SectionType> = Extract<HomeSection, { type: T }>["data"];
export const SECTION_LABEL: Record<SectionType, string> = {
  hero: "Hero", banner: "Promotional banners", featuredCategories: "Featured categories", featuredProducts: "Featured products", latestProducts: "Latest products",
  bestSellers: "Best sellers", richText: "Rich text", imageText: "Image + text", testimonials: "Testimonials", offer: "Promotional offer", custom: "Custom block", latestPosts: "Latest blog posts / guides",
};
export const defaultData: { [T in SectionType]: Data<T> } = {
  hero: { heading: "", subheading: "", imageUrl: "", imageAlt: "", ctaLabel: "", ctaUrl: "", secondaryCtaLabel: "", secondaryCtaUrl: "" },
  banner: { items: [{ imageUrl: "", imageAlt: "", heading: "", text: "", linkUrl: "" }] },
  featuredCategories: { heading: "Shop by category", categoryIds: [] },
  featuredProducts: { heading: "Featured", category: "", limit: 8 },
  latestProducts: { heading: "New arrivals", category: "", limit: 8 },
  bestSellers: { heading: "Best sellers", category: "", limit: 8 },
  richText: { markdown: "" },
  imageText: { heading: "", markdown: "", imageUrl: "", imageAlt: "", imagePosition: "left", ctaLabel: "", ctaUrl: "" },
  testimonials: { heading: "What devotees say", items: [{ quote: "", author: "", role: "" }] },
  offer: { heading: "", text: "", code: "", ctaLabel: "", ctaUrl: "", expiresAt: "" },
  custom: { markdown: "", tone: "plain" },
  latestPosts: { heading: "From our blog", kind: "blog", limit: 3 },
};
