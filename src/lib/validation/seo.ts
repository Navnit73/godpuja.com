import { z } from "zod";
import { optionalUrl } from "./pages";

export const seoSettingsSchema = z.object({
  siteName: z.string().trim().min(2, "Enter the site name").max(60),
  defaultTitle: z.string().trim().max(70, "Keep under 70 characters"),
  defaultDescription: z.string().trim().max(200, "Keep under 200 characters"),
  defaultOgImage: optionalUrl,
  twitterHandle: z.union([z.literal(""), z.string().trim().regex(/^@[A-Za-z0-9_]{1,15}$/, "Like @godpuja")]),
  logoUrl: optionalUrl,
  homeTitle: z.string().trim().max(70, "Keep under 70 characters"),
  homeDescription: z.string().trim().max(200, "Keep under 200 characters"),
});
export const updateSeoSettingsSchema = seoSettingsSchema.extend({ baseUpdatedAt: z.iso.datetime({ offset: true }).nullable() });
export type SeoSettings = z.infer<typeof seoSettingsSchema>;
export type UpdateSeoSettings = z.infer<typeof updateSeoSettingsSchema>;
export const defaultSeoSettings: SeoSettings = {
  siteName: "GodPuja", defaultTitle: "GodPuja — Sacred rituals, made simple", defaultDescription: "Book pujas, find blessings and connect with tradition.",
  defaultOgImage: "", twitterHandle: "", logoUrl: "", homeTitle: "", homeDescription: "",
};

/** Paths that can never be redirect sources (app internals) — redirecting them would break the site or the admin. */
const BLOCKED = /^\/(?:api|admin|_next|login|preview|order)(?:\/|$)/;
const PATH = /^\/(?!\/)[^\s\\?#]{0,399}$/;
export const normalisePath = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p).toLowerCase();

export const redirectInputSchema = z.object({
  from: z.string().trim().max(400).regex(PATH, "Use a path like /old-page").transform(normalisePath)
    .refine((p) => p !== "/" && !BLOCKED.test(p), "This path cannot be redirected"),
  to: z.string().trim().max(400).refine((v) => PATH.test(v) || z.url({ protocol: /^https$/ }).safeParse(v).success, "Use a path like /new-page or a full https:// URL"),
}).refine((r) => r.from !== normalisePath(r.to), { path: ["to"], message: "A page cannot redirect to itself" });
export type RedirectInput = z.infer<typeof redirectInputSchema>;

export const listRedirectsSchema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});
