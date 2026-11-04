import { connectDB } from "../db";
import { env } from "../env";
import { Product, type ProductDoc } from "../models/Product";
import { loadCategoryIndex, sortedImages } from "./products";
import { BASE_CURRENCY } from "@/lib/money";
import { assemble, computeTax, type Discount, type TaxTerms } from "@/lib/pricing";
import { MAX_LINE_QTY, type CartLineInput, type QuoteInput } from "@/lib/validation/orders";
import { checkCoupon } from "./coupons";
import { taxTermsFor } from "./tax";

export type CartIssue = { productId: string; variantSku: string | null; code: "unavailable" | "out_of_stock" | "reduced"; message: string };
export type CartLine = {
  productId: string; variantSku: string | null; sku: string; name: string; slug: string; image: { url: string; alt: string } | null;
  options: Record<string, string>; unitPrice: number; qty: number; lineTotal: number; available: boolean; maxQty: number; freeShipping: boolean;
};
/** Amounts in integer minor units of `currency` (the catalogue currency, BASE_CURRENCY). */
export type CartPricing = {
  currency: string; subtotal: number; discount: number; shipping: number;
  /** Tax in the total (inclusive) or added to it (exclusive). taxName is null when no rule applies to the destination. */
  tax: number; taxName: string | null; taxRateBps: number; taxInclusive: boolean;
  total: number; freeShippingOver: number; flatShipping: number;
};
export type CartCoupon = { code: string; type: "percent" | "fixed" | "free_shipping"; discount: number };
export type CartResult = { items: CartLine[]; issues: CartIssue[]; pricing: CartPricing; coupon: CartCoupon | null; couponError: string | null };

export const shippingConfig = () => ({ flat: env().SHIPPING_FLAT_PAISE, freeOver: env().FREE_SHIPPING_OVER_PAISE });

/** Same product + variant twice => one line (quantities add up), so stock is checked and decremented once per SKU. */
export function mergeLines(items: CartLineInput[]): CartLineInput[] {
  const map = new Map<string, CartLineInput>();
  for (const it of items) {
    const key = `${it.productId}:${it.variantSku ?? ""}`;
    const cur = map.get(key);
    map.set(key, cur ? { ...cur, qty: cur.qty + it.qty } : { ...it });
  }
  return [...map.values()];
}

/** Selling price in paise: variant price/sale if set, else the product's. Never taken from the client. */
export function unitPriceOf(p: Pick<ProductDoc, "price" | "salePrice">, v?: { price?: number | null; salePrice?: number | null } | null): number {
  const price = v?.price ?? p.price;
  const sale = v?.salePrice ?? (v?.price == null ? p.salePrice ?? null : null);
  return sale != null && sale < price ? sale : price;
}

export function computePricing(lines: Pick<CartLine, "lineTotal" | "freeShipping" | "available">[]): CartPricing {
  const { flat, freeOver } = shippingConfig();
  const live = lines.filter((l) => l.available);
  const subtotal = live.reduce((n, l) => n + l.lineTotal, 0);
  const free = subtotal >= freeOver || live.some((l) => l.freeShipping);
  const shipping = subtotal === 0 || free ? 0 : flat;
  return { currency: BASE_CURRENCY, subtotal, discount: 0, shipping, tax: 0, taxName: null, taxRateBps: 0, taxInclusive: true, total: subtotal + shipping, freeShippingOver: freeOver, flatShipping: flat };
}

/** Apply a coupon's discount and the destination's tax to the base pricing. Pure; the order total is assembled in lib/pricing. */
export function finalizePricing(base: CartPricing, discount: Discount, tax: TaxTerms | null): CartPricing {
  const t = computeTax(tax, base.subtotal - discount.goods, base.shipping - discount.shipping);
  const p = assemble(base.subtotal, base.shipping, discount, t);
  return { ...base, discount: p.discount, tax: p.tax, taxName: tax && tax.rateBps > 0 ? tax.name : null, taxRateBps: tax?.rateBps ?? 0, taxInclusive: tax?.inclusive ?? true, total: p.total };
}

type LoadedProduct = Pick<ProductDoc, "_id" | "name" | "slug" | "sku" | "images" | "price" | "salePrice" | "stock" | "variants" | "status" | "category" | "shipping">;
export const CART_FIELDS = "name slug sku images price salePrice stock variants status category shipping.freeShipping";

/**
 * Pure line resolution. `products` must come from the database (inside the checkout transaction for real orders).
 * A line is `available` only if its product is active, not hidden by an inactive category, the variant exists
 * and there is stock. Quantity is clamped to stock (`reduced`).
 */
export function resolveLines(items: CartLineInput[], products: Map<string, LoadedProduct>, hidden: Set<string>): { lines: CartLine[]; issues: CartIssue[] } {
  const lines: CartLine[] = [];
  const issues: CartIssue[] = [];
  for (const it of mergeLines(items)) {
    const vs = it.variantSku ?? null;
    const dead = (message: string, code: CartIssue["code"] = "unavailable", p?: LoadedProduct): CartLine => {
      issues.push({ productId: it.productId, variantSku: vs, code, message });
      return {
        productId: it.productId, variantSku: vs, sku: p?.sku ?? "", name: p?.name ?? "Unavailable item", slug: p?.slug ?? "", image: p ? sortedImages(p as ProductDoc)[0] ?? null : null,
        options: {}, unitPrice: 0, qty: it.qty, lineTotal: 0, available: false, maxQty: 0, freeShipping: false,
      };
    };
    const p = products.get(it.productId);
    if (p?.status === "upcoming") { lines.push(dead("This item is coming soon and can't be ordered yet.", "unavailable", p)); continue; }
    if (!p || p.status !== "active" || (p.category && hidden.has(String(p.category)))) { lines.push(dead("This item is no longer available.")); continue; }
    const hasVariants = (p.variants ?? []).length > 0;
    const variant = hasVariants ? p.variants.find((v) => v.sku === vs) : null;
    if (hasVariants && !variant) { lines.push(dead("Choose an available option for this item.", "unavailable", p)); continue; }
    if (!hasVariants && vs) { lines.push(dead("This option is no longer available.", "unavailable", p)); continue; }
    const stock = variant ? variant.stock : p.stock;
    if (stock <= 0) { lines.push(dead("This item is out of stock.", "out_of_stock", p)); continue; }
    const maxQty = Math.min(MAX_LINE_QTY, stock);
    const qty = Math.min(it.qty, maxQty);
    if (qty < it.qty) issues.push({ productId: it.productId, variantSku: vs, code: "reduced", message: `Only ${stock} in stock; quantity reduced to ${qty}.` });
    const unitPrice = unitPriceOf(p, variant);
    const opts = variant ? (variant.options instanceof Map ? Object.fromEntries(variant.options) : { ...(variant.options as Record<string, string>) }) : {};
    lines.push({
      productId: it.productId, variantSku: variant ? variant.sku : null, sku: variant ? variant.sku : p.sku, name: p.name, slug: p.slug,
      image: sortedImages(p as ProductDoc)[0] ?? null, options: opts, unitPrice, qty, lineTotal: unitPrice * qty, available: true, maxQty, freeShipping: !!p.shipping?.freeShipping,
    });
  }
  return { lines, issues };
}

export async function hiddenCategorySet() {
  const { hidden } = await loadCategoryIndex({ fresh: true }); // exact visibility for what can be bought
  return new Set(hidden.map(String));
}

/** POST /cart/validate: recompute everything server-side so the browser never decides a price or a quantity. */
export async function validateCart(items: CartLineInput[], opts: Partial<Pick<QuoteInput, "couponCode" | "country">> = {}): Promise<CartResult> {
  await connectDB();
  const ids = [...new Set(items.map((i) => i.productId))];
  const [rows, hidden] = await Promise.all([Product.find({ _id: { $in: ids } }).select(CART_FIELDS).lean(), hiddenCategorySet()]);
  const products = new Map(rows.map((r) => [String(r._id), r as unknown as LoadedProduct]));
  const { lines, issues } = resolveLines(items, products, hidden);
  const base = computePricing(lines);
  // A bad code never fails the cart: it comes back as a message and the cart is priced without it.
  let coupon: CartCoupon | null = null, couponError: string | null = null, discount: Discount = { goods: 0, shipping: 0, total: 0 };
  if (opts.couponCode) {
    const r = await checkCoupon(opts.couponCode, base.subtotal, base.shipping);
    if ("error" in r) couponError = r.error;
    else { discount = r.coupon.discount; coupon = { code: r.coupon.code, type: r.coupon.type, discount: discount.total }; }
  }
  const pricing = finalizePricing(base, discount, await taxTermsFor(opts.country));
  return { items: lines, issues, pricing, coupon, couponError };
}

