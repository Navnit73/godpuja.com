import { z } from "zod";

export const MAX_MENU_ITEMS = 100;
export const MENU_DEPTH = 3;

/** Internal path ("/about") or absolute http(s) URL. Same rule as page CTA links. */
export const linkUrl = z.string().max(2000).refine(
  (v) => z.url({ protocol: /^https?$/ }).safeParse(v).success || /^\/(?!\/)[^\s\\]*$/.test(v),
  "Use a path like /about or a full https:// URL",
);

// Catalog link types (category | product) are in the stored schema but only become selectable in Stage 6,
// once those collections exist. Until then they are rejected here rather than producing dead links.
const itemBase = z.object({
  id: z.string().min(1).max(40),
  label: z.string().trim().min(1, "Enter a label").max(60),
  type: z.enum(["page", "external"]),
  ref: z.string().regex(/^[a-f0-9]{24}$/, "Choose a page").optional(),
  url: z.string().trim().max(2000).optional(),
  openInNewTab: z.boolean(),
  enabled: z.boolean(),
  showOnDesktop: z.boolean(),
  showOnMobile: z.boolean(),
});

export function checkTarget(i: { type: "page" | "external"; ref?: string; url?: string }, ctx: z.RefinementCtx) {
  if (i.type === "page" && !i.ref) ctx.addIssue({ code: "custom", path: ["ref"], message: "Choose a page" });
  if (i.type === "external") {
    const r = linkUrl.safeParse(i.url ?? "");
    if (!r.success) ctx.addIssue({ code: "custom", path: ["url"], message: r.error.issues[0]?.message ?? "Enter a link" });
  }
}

export type MenuItemInput = z.infer<typeof itemBase> & { children: MenuItemInput[] };

// Depth is enforced structurally: a third-level item has no `children` key to fill.
const level3 = itemBase.extend({ children: z.array(z.never()).max(0).default([]) }).superRefine(checkTarget);
const level2 = itemBase.extend({ children: z.array(level3).max(30).default([]) }).superRefine(checkTarget);
const level1 = itemBase.extend({ children: z.array(level2).max(30).default([]) }).superRefine(checkTarget);

function flatten(items: MenuItemInput[]): MenuItemInput[] {
  return items.flatMap((i) => [i, ...flatten(i.children)]);
}
export const countItems = (items: MenuItemInput[]) => flatten(items).length;
export const pageRefs = (items: MenuItemInput[]) => [...new Set(flatten(items).filter((i) => i.type === "page" && i.ref).map((i) => i.ref as string))];

const itemsSchema = z
  .array(level1)
  .max(30, "At most 30 top-level items")
  .refine((a) => countItems(a as MenuItemInput[]) <= MAX_MENU_ITEMS, `At most ${MAX_MENU_ITEMS} items in total`)
  .refine((a) => {
    const ids = flatten(a as MenuItemInput[]).map((i) => i.id);
    return new Set(ids).size === ids.length;
  }, "Item ids must be unique");

export const menuKeySchema = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens").max(40);

export const createMenuSchema = z.object({
  key: menuKeySchema,
  name: z.string().trim().min(2, "Enter a name").max(80),
});

/** Whole-tree save. `baseUpdatedAt` is the version the editor loaded (stale => 409). */
export const updateMenuSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80),
  items: itemsSchema,
  baseUpdatedAt: z.iso.datetime({ offset: true }),
});

export type CreateMenuInput = z.infer<typeof createMenuSchema>;
export type UpdateMenuInput = z.infer<typeof updateMenuSchema>;
