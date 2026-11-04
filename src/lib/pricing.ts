// Shared (client + server safe). Pure money maths for coupons and tax, in integer minor units (PRD v1.1 §13: no floats
// in financial calculations; the only division is rounded once, at the end of each formula).

export const COUPON_TYPES = ["percent", "fixed", "free_shipping"] as const;
export type CouponType = (typeof COUPON_TYPES)[number];
export type CouponTerms = { type: CouponType; value: number; maxDiscount?: number | null };

export type Discount = { goods: number; shipping: number; total: number };
const NONE: Discount = { goods: 0, shipping: 0, total: 0 };

/**
 * What a coupon takes off. `percent`: whole percent of the goods, optionally capped. `fixed`: a fixed amount, never more
 * than the goods. `free_shipping`: the shipping charge. A discount can never push the goods below zero.
 */
export function computeDiscount(c: CouponTerms, subtotal: number, shipping: number): Discount {
  if (subtotal <= 0) return NONE;
  let goods = 0, ship = 0;
  if (c.type === "percent") {
    goods = Math.floor((subtotal * c.value) / 100);
    if (c.maxDiscount != null) goods = Math.min(goods, c.maxDiscount);
  } else if (c.type === "fixed") goods = c.value;
  else ship = Math.max(0, shipping);
  goods = Math.min(Math.max(0, goods), subtotal);
  return { goods, shipping: ship, total: goods + ship };
}

/** `rateBps` is hundredths of a percent: 1800 = 18%, 550 = 5.5%. */
export type TaxTerms = { name: string; rateBps: number; inclusive: boolean; appliesToShipping: boolean };
export const rateLabel = (bps: number) => `${(bps / 100).toFixed(2).replace(/\.?0+$/, "")}%`;

/**
 * Tax on what the customer actually pays for (goods after discount, and shipping after discount when the rule taxes it).
 * Inclusive: the tax is already inside the prices, so it is reported but not added. Exclusive: it is added to the total.
 */
export function computeTax(t: TaxTerms | null, goodsBase: number, shippingBase: number): { tax: number; added: number } {
  if (!t || t.rateBps <= 0) return { tax: 0, added: 0 };
  const base = Math.max(0, goodsBase) + (t.appliesToShipping ? Math.max(0, shippingBase) : 0);
  if (t.inclusive) return { tax: Math.round((base * t.rateBps) / (10_000 + t.rateBps)), added: 0 };
  const tax = Math.round((base * t.rateBps) / 10_000);
  return { tax, added: tax };
}

export type PriceBreakdown = { subtotal: number; discount: number; shipping: number; tax: number; taxAdded: number; total: number };

/** The one place the order total is assembled: goods − discount + shipping (after shipping discount) + tax added on top. */
export function assemble(subtotal: number, shipping: number, d: Discount, tax: { tax: number; added: number }): PriceBreakdown {
  return { subtotal, discount: d.total, shipping, tax: tax.tax, taxAdded: tax.added, total: subtotal - d.goods + (shipping - d.shipping) + tax.added };
}
