import { z } from "zod";
import { isCountry } from "@/lib/address";
import { COUPON_TYPES } from "@/lib/pricing";

export const COUPON_CODE = /^[A-Z0-9][A-Z0-9_-]{2,29}$/;
const code = z.string().trim().toUpperCase().regex(COUPON_CODE, "Use 3–30 letters, numbers, dashes or underscores");
export const couponCodeSchema = code;

const money = z.number().int("Whole minor units").min(0).max(100_000_000_00);
const date = z.union([z.literal(""), z.null(), z.iso.datetime({ offset: true })]).transform((v) => (v ? v : null));

export const couponSchema = z.object({
  code,
  description: z.string().trim().max(200).default(""),
  type: z.enum(COUPON_TYPES),
  value: money,
  maxDiscount: money.min(1).nullish().transform((v) => v ?? null),
  minSubtotal: money.default(0),
  startsAt: date.optional().transform((v) => v ?? null),
  expiresAt: date.optional().transform((v) => v ?? null),
  usageLimit: z.number().int().min(1).max(10_000_000).nullish().transform((v) => v ?? null),
  perCustomerLimit: z.number().int().min(1).max(1000).nullish().transform((v) => v ?? null),
  isActive: z.boolean().default(true),
}).superRefine((c, ctx) => {
  if (c.type === "percent" && (c.value < 1 || c.value > 100)) ctx.addIssue({ code: "custom", path: ["value"], message: "A percentage must be between 1 and 100" });
  if (c.type === "fixed" && c.value < 1) ctx.addIssue({ code: "custom", path: ["value"], message: "Enter an amount" });
  if (c.type !== "percent" && c.maxDiscount != null) ctx.addIssue({ code: "custom", path: ["maxDiscount"], message: "A cap only applies to percentage coupons" });
  if (c.startsAt && c.expiresAt && Date.parse(c.expiresAt) <= Date.parse(c.startsAt)) ctx.addIssue({ code: "custom", path: ["expiresAt"], message: "Must be after the start" });
});
export type CouponInput = z.infer<typeof couponSchema>;
/** Updates may not change the code (orders and redemption counters refer to it). */
export const updateCouponSchema = couponSchema.safeExtend({ baseUpdatedAt: z.iso.datetime({ offset: true }) });

export const taxRuleSchema = z.object({
  country: z.string().trim().toUpperCase().refine(isCountry, "Choose a country"),
  name: z.string().trim().min(1, "Enter a name such as GST or VAT").max(30),
  rateBps: z.number().int().min(0, "Cannot be negative").max(10_000, "At most 100%"),
  inclusive: z.boolean(),
  appliesToShipping: z.boolean(),
  isActive: z.boolean().default(true),
});
export type TaxRuleInput = z.infer<typeof taxRuleSchema>;
