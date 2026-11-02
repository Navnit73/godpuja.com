import { z } from "zod";
import { checkTarget } from "./menus";

export const SOCIAL_PLATFORMS = ["facebook", "instagram", "x", "youtube", "whatsapp", "linkedin", "telegram"] as const;

const id = z.string().min(1).max(40);
const linkBase = z.object({
  id,
  label: z.string().trim().min(1, "Enter a label").max(60),
  type: z.enum(["page", "external"]),
  ref: z.string().regex(/^[a-f0-9]{24}$/, "Choose a page").optional(),
  url: z.string().trim().max(2000).optional(),
  openInNewTab: z.boolean(),
  enabled: z.boolean(),
});
export const footerLinkSchema = linkBase.superRefine(checkTarget);
export type FooterLinkInput = z.infer<typeof footerLinkSchema>;

const column = z.object({
  id,
  heading: z.string().trim().min(1, "Enter a heading").max(60),
  enabled: z.boolean(),
  links: z.array(footerLinkSchema).max(12, "At most 12 links per column"),
});

const social = z.object({
  id,
  platform: z.enum(SOCIAL_PLATFORMS),
  url: z.url({ protocol: /^https$/, message: "Enter a full https URL" }).max(2000),
  enabled: z.boolean(),
});

const uniqueIds = (all: { id: string }[]) => new Set(all.map((x) => x.id)).size === all.length;

export const footerInputSchema = z.object({
  columns: z.array(column).max(6, "At most 6 columns").refine((c) => uniqueIds([...c, ...c.flatMap((x) => x.links)]), "Ids must be unique"),
  social: z.array(social).max(10).refine(uniqueIds, "Ids must be unique"),
  contact: z.object({
    address: z.string().trim().max(300),
    phone: z
      .string().trim().max(30)
      .regex(/^[+\d][\d\s().-]*$|^$/, "Use digits, spaces, + ( ) . -")
      .refine((v) => v === "" || v.replace(/\D/g, "").length >= 5, "Enter a complete phone number"),
    email: z.union([z.literal(""), z.email("Enter a valid email")]),
  }),
  newsletter: z.object({ enabled: z.boolean(), heading: z.string().trim().max(80), text: z.string().trim().max(200) }),
  legalLinks: z.array(footerLinkSchema).max(8, "At most 8 legal links").refine(uniqueIds, "Ids must be unique"),
  /** `{year}` is replaced with the current year when rendered. */
  copyright: z.string().trim().max(200),
});

/** `baseUpdatedAt` is null only when saving for the first time (no footer stored yet). */
export const updateFooterSchema = footerInputSchema.extend({ baseUpdatedAt: z.iso.datetime({ offset: true }).nullable() });

export const subscribeSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email")),
  _hp: z.string().optional(), // honeypot (any length, so oversized bot input is not rejected and the trap stays hidden)
});

export type FooterInput = z.infer<typeof footerInputSchema>;
export type UpdateFooterInput = z.infer<typeof updateFooterSchema>;
export const emptyFooter: FooterInput = {
  columns: [], social: [], contact: { address: "", phone: "", email: "" },
  newsletter: { enabled: false, heading: "Stay connected", text: "Festival dates and puja offers, occasionally." },
  legalLinks: [], copyright: "© {year} GodPuja. All rights reserved.",
};
