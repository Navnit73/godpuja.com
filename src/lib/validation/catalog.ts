import { z } from "zod";
import { seoSchema } from "./pages";

const httpUrl = z.url({ protocol: /^https?$/, message: "Enter a full http(s) URL" }).max(2000);
const optionalUrl = z.union([z.literal(""), httpUrl]);
const id = z.string().regex(/^[a-f0-9]{24}$/, "Invalid id");
const segment = z.string().trim().toLowerCase().min(1, "Enter a URL slug").max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens");

// ---------- categories ----------
export const MAX_CATEGORY_DEPTH = 3;
export const categoryInputSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80),
  slug: segment,
  parent: id.nullable(),
  description: z.string().trim().max(1000),
  image: z.object({ url: optionalUrl, alt: z.string().trim().max(200) })
    .refine((i) => !i.url || i.alt.length > 0, { path: ["alt"], message: "Describe the image for accessibility" }),
  order: z.number().int().min(0).max(100000),
  isActive: z.boolean(),
  seo: seoSchema,
});
export const updateCategorySchema = categoryInputSchema.extend({ baseUpdatedAt: z.iso.datetime({ offset: true }) });
export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// ---------- products ----------
const paise = z.number().int("Whole paise only").min(0).max(100_000_000_00);
const sku = z.string().trim().toUpperCase().min(2, "Enter a SKU").max(40).regex(/^[A-Z0-9][A-Z0-9._-]*$/, "Use letters, numbers, . _ -");

// Option names become MongoDB Map keys: no dots, no leading $, no NUL, no prototype names.
const optionKey = z.string().trim().min(1).max(40)
  .regex(/^[^.$\0][^.\0]*$/, "Option names cannot contain dots or start with $")
  .refine((k) => !["__proto__", "constructor", "prototype"].includes(k), "Reserved name");

const variant = z.object({
  sku,
  options: z.record(optionKey, z.string().trim().min(1).max(60))
    .refine((o) => { const n = Object.keys(o).length; return n >= 1 && n <= 4; }, "1–4 options (e.g. Size, Weight)"),
  price: paise.nullable().optional(),
  salePrice: paise.nullable().optional(),
  stock: z.number().int().min(0).max(10_000_000),
}).refine((v) => v.salePrice == null || v.price == null || v.salePrice < v.price, { path: ["salePrice"], message: "Sale price must be below the price" });

export const productInputSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(160),
  slug: segment,
  sku,
  shortDescription: z.string().trim().max(300),
  description: z.string().max(20000),
  images: z.array(z.object({ url: httpUrl, alt: z.string().trim().min(1, "Describe the image").max(200) })).max(10, "At most 10 images"),
  category: id.nullable(),
  brand: z.string().trim().max(80),
  price: paise,
  salePrice: paise.nullable(),
  stock: z.number().int().min(0).max(10_000_000),
  lowStockThreshold: z.number().int().min(0).max(100000),
  status: z.enum(["draft", "active", "upcoming", "archived"]),
  isFeatured: z.boolean(),
  attributes: z.array(z.object({ name: z.string().trim().min(1).max(60), value: z.string().trim().min(1).max(200) })).max(20),
  variants: z.array(variant).max(50, "At most 50 variants"),
  shipping: z.object({
    weightGrams: z.number().int().min(0).max(1_000_000), length: z.number().min(0).max(1000), width: z.number().min(0).max(1000),
    height: z.number().min(0).max(1000), freeShipping: z.boolean(),
  }),
  seo: seoSchema,
}).superRefine((p, ctx) => {
  if (p.salePrice != null && p.salePrice >= p.price) ctx.addIssue({ code: "custom", path: ["salePrice"], message: "Sale price must be below the price" });
  p.variants.forEach((v, i) => {
    const base = v.price ?? p.price; // a variant without its own price sells at the product price
    if (v.salePrice != null && v.salePrice >= base) ctx.addIssue({ code: "custom", path: ["variants", i, "salePrice"], message: "Sale price must be below the price" });
  });
  const skus = [p.sku, ...p.variants.map((v) => v.sku)];
  if (new Set(skus).size !== skus.length) ctx.addIssue({ code: "custom", path: ["variants"], message: "SKUs must be unique (including the product SKU)" });
  if ((p.status === "active" || p.status === "upcoming") && !p.category) ctx.addIssue({ code: "custom", path: ["category"], message: "Choose a category before publishing" });
  if (p.status === "active" && p.price <= 0) ctx.addIssue({ code: "custom", path: ["price"], message: "Set a price before activating" });
});
export const updateProductSchema = productInputSchema.safeExtend({ baseUpdatedAt: z.iso.datetime({ offset: true }) });
export type ProductInput = z.infer<typeof productInputSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const listProductsSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["draft", "active", "upcoming", "archived"]).optional(),
  category: id.optional(),
  lowStock: z.enum(["1"]).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListProductsInput = z.infer<typeof listProductsSchema>;

export const publicProductsSchema = z.object({
  category: z.string().trim().max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*){0,2}$/).optional(), // category path
  q: z.string().trim().min(2).max(100).optional(),
  sort: z.enum(["newest", "price-asc", "price-desc", "popular"]).default("newest"),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  featured: z.enum(["1"]).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});
export type PublicProductsInput = z.infer<typeof publicProductsSchema>;

/** Stock change: relative (`delta`) or absolute (`set`). `sku` targets a variant. */
export const inventorySchema = z.union([
  z.object({ sku: sku.optional(), delta: z.number().int().min(-1_000_000).max(1_000_000).refine((n) => n !== 0, "Change must not be 0") }),
  z.object({ sku: sku.optional(), set: z.number().int().min(0).max(10_000_000) }),
]);
export type InventoryInput = z.infer<typeof inventorySchema>;

export const mediaAltSchema = z.object({ alt: z.string().trim().max(200) });
export const emptyCategory: CategoryInput = {
  name: "", slug: "", parent: null, description: "", image: { url: "", alt: "" }, order: 0, isActive: true,
  seo: { title: "", description: "", canonical: "", ogImage: "", noindex: false },
};
