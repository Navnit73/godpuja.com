import { z } from "zod";
import { optionalUrl, publishSchema, seoSchema } from "./pages";

/** PRD v1.1 §9. Aarti live under /aarti/, every other kind under /mantras/. */
export const DEVOTIONAL_TYPES = [
  { key: "aarti", label: "Aarti", plural: "Aarti" },
  { key: "mantra", label: "Mantra", plural: "Mantras" },
  { key: "chalisa", label: "Chalisa", plural: "Chalisas" },
  { key: "stotra", label: "Stotra", plural: "Stotras" },
] as const;
export type DevotionalType = (typeof DEVOTIONAL_TYPES)[number]["key"];
export const DEVOTIONAL_TYPE_KEYS = DEVOTIONAL_TYPES.map((t) => t.key) as [DevotionalType, ...DevotionalType[]];
export const MANTRA_TYPE_KEYS = DEVOTIONAL_TYPE_KEYS.filter((k) => k !== "aarti") as DevotionalType[];
export const devotionalTypeLabel = (k: string) => DEVOTIONAL_TYPES.find((t) => t.key === k)?.label ?? k;

export const DEVOTIONAL_LANGUAGES = [
  { key: "sanskrit", label: "Sanskrit", lang: "sa" },
  { key: "hindi", label: "Hindi", lang: "hi" },
  { key: "english", label: "English", lang: "en" },
  { key: "tamil", label: "Tamil", lang: "ta" },
  { key: "telugu", label: "Telugu", lang: "te" },
  { key: "bengali", label: "Bengali", lang: "bn" },
  { key: "marathi", label: "Marathi", lang: "mr" },
  { key: "gujarati", label: "Gujarati", lang: "gu" },
] as const;
export type DevotionalLanguage = (typeof DEVOTIONAL_LANGUAGES)[number]["key"];
export const DEVOTIONAL_LANGUAGE_KEYS = DEVOTIONAL_LANGUAGES.map((l) => l.key) as [DevotionalLanguage, ...DevotionalLanguage[]];
export const devotionalLanguageLabel = (k: string) => DEVOTIONAL_LANGUAGES.find((l) => l.key === k)?.label ?? k;
/** BCP 47 code for the lyrics element, so Devanagari gets the right font. */
export const devotionalLangCode = (k: string) => DEVOTIONAL_LANGUAGES.find((l) => l.key === k)?.lang ?? "en";

/** Where the recording comes from. Only these may be played (PRD v1.1 §9: original, licensed or public domain). */
export const AUDIO_LICENCES = [
  { key: "original", label: "Original recording (we own it)" },
  { key: "licensed", label: "Licensed from a rights holder" },
  { key: "public-domain", label: "Public domain" },
] as const;
export type AudioLicence = (typeof AUDIO_LICENCES)[number]["key"];
export const AUDIO_LICENCE_KEYS = AUDIO_LICENCES.map((l) => l.key) as [AudioLicence, ...AudioLicence[]];
export const audioLicenceLabel = (k: string) => AUDIO_LICENCES.find((l) => l.key === k)?.label ?? k;

export const AARTI_BASE = "/aarti";
export const MANTRA_BASE = "/mantras";
export const devotionalBase = (type: string) => (type === "aarti" ? AARTI_BASE : MANTRA_BASE);
export const devotionalHref = (type: string, slug: string) => `${devotionalBase(type)}/${slug}`;

const slugPart = z.string().trim().toLowerCase().min(1, "Enter a slug").max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single dashes");
const refSlug = z.string().trim().toLowerCase().max(80).refine((v) => v === "" || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v), "Use a slug like ganesh-aarti");
const unique = (a: string[]) => [...new Set(a.filter(Boolean))];
const dateField = z.union([z.literal(""), z.iso.datetime({ offset: true })]).default("");

export const rightsSchema = z.object({
  /** Who made or owns the recording, e.g. "Recorded for GodPuja by …" or "Acme Music". */
  source: z.string().trim().max(200).default(""),
  licence: z.union([z.literal(""), z.enum(AUDIO_LICENCE_KEYS)]).default(""),
  /** Reference to the permission, licence number or URL of the agreement. */
  reference: z.string().trim().max(500).default(""),
  /** When the permission ends ("" = does not expire). Audio is hidden automatically after this moment. */
  expiresAt: dateField,
  /** Rights holder asked us to take it down. Audio stops being offered at once. */
  withdrawn: z.boolean().default(false),
});

const fields = z.object({
  title: z.string().trim().min(2, "Enter a title").max(120),
  slug: slugPart,
  type: z.enum(DEVOTIONAL_TYPE_KEYS),
  deity: z.string().trim().max(60).default(""),
  language: z.enum(DEVOTIONAL_LANGUAGE_KEYS).default("sanskrit"),
  /** The text itself, one line per line, blank line between verses. Plain text (not Markdown) so line breaks are kept as written. */
  lyrics: z.string().trim().max(30_000).default(""),
  /** Romanised text for people who cannot read the script (optional). */
  transliteration: z.string().trim().max(30_000).default(""),
  /** Meaning / translation (Markdown). */
  meaning: z.string().trim().max(10_000).default(""),
  summary: z.string().trim().max(500).default(""),
  audioUrl: optionalUrl.default(""),
  audioDurationSeconds: z.number().int().min(1).max(36_000).nullish().transform((v) => v ?? null),
  rights: rightsSchema,
  relatedAarti: z.array(refSlug).max(8).default([]).transform(unique),
  relatedVidhi: z.array(refSlug).max(6).default([]).transform(unique),
  relatedProducts: z.array(refSlug).max(8).default([]).transform(unique),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(30)).max(12).default([]).transform(unique),
  coverImageUrl: optionalUrl.default(""),
  coverImageAlt: z.string().trim().max(200).default(""),
  reviewer: z.string().trim().max(80).default(""),
  reviewedAt: dateField,
  seo: seoSchema,
}).superRefine((v, ctx) => {
  const add = (path: string[], message: string) => ctx.addIssue({ code: "custom", path, message });
  if (v.coverImageUrl && !v.coverImageAlt) add(["coverImageAlt"], "Describe the image for accessibility");
  if (v.reviewedAt && !v.reviewer) add(["reviewer"], "Who reviewed it?");
  if (v.reviewer && !v.reviewedAt) add(["reviewedAt"], "When was it reviewed?");
  if (v.relatedAarti.includes(v.slug)) add(["relatedAarti"], "An item cannot relate to itself");
  // A recording may be stored only with its permission recorded; without it the audio is never offered.
  if (v.audioUrl) {
    if (!v.rights.source) add(["rights", "source"], "Who made or owns this recording?");
    if (!v.rights.licence) add(["rights", "licence"], "Choose how we are allowed to use it");
    if (v.rights.licence === "licensed" && !v.rights.reference) add(["rights", "reference"], "Add the licence reference or agreement");
  }
});

export const devotionalInputSchema = fields;
export const updateDevotionalSchema = z.object({ baseUpdatedAt: z.iso.datetime({ offset: true }) }).and(fields);
export const devotionalPublishSchema = publishSchema;
export const listDevotionalSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["draft", "published", "scheduled"]).optional(),
  type: z.enum(DEVOTIONAL_TYPE_KEYS).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export const publicDevotionalSchema = z.object({
  type: z.enum(DEVOTIONAL_TYPE_KEYS).optional(),
  deity: z.string().trim().max(60).optional(),
  language: z.enum(DEVOTIONAL_LANGUAGE_KEYS).optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export type DevotionalInput = z.infer<typeof devotionalInputSchema>;
export type UpdateDevotionalInput = z.infer<typeof updateDevotionalSchema>;
export type ListDevotionalInput = z.infer<typeof listDevotionalSchema>;
export type PublicDevotionalInput = z.infer<typeof publicDevotionalSchema>;

export const emptyDevotional: DevotionalInput = {
  title: "", slug: "", type: "aarti", deity: "", language: "sanskrit", lyrics: "", transliteration: "", meaning: "", summary: "", audioUrl: "", audioDurationSeconds: null,
  rights: { source: "", licence: "", reference: "", expiresAt: "", withdrawn: false },
  relatedAarti: [], relatedVidhi: [], relatedProducts: [], tags: [], coverImageUrl: "", coverImageAlt: "", reviewer: "", reviewedAt: "",
  seo: { title: "", description: "", canonical: "", ogImage: "", noindex: false },
};
