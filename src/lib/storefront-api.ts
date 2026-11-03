// Shapes returned by the cart/checkout/order endpoints (see docs/API_DOCUMENTATION.md, Stages 9 and 12).
import type { Address } from "./address";
export type { Address };
export type CartItem = {
  productId: string; variantSku: string | null; sku: string; name: string; slug: string; image: { url: string; alt: string } | null;
  options: Record<string, string>; unitPrice: number; qty: number; lineTotal: number; available: boolean; maxQty: number; freeShipping: boolean;
};
export type CartIssue = { productId: string; variantSku: string | null; code: "unavailable" | "out_of_stock" | "reduced"; message: string };
/** Integer minor units of `currency` (ISO 4217). */
export type CartPricing = { currency: string; subtotal: number; shipping: number; total: number; freeShippingOver: number; flatShipping: number };
export type CartValidation = { items: CartItem[]; issues: CartIssue[]; pricing: CartPricing };

export type CheckoutResult = { orderId: string; orderNumber: string; accessToken: string; status: string; currency: string; payment: { method: string; status: string } };
export type OrderView = {
  orderNumber: string; status: string; createdAt: string; email?: string; currency: string;
  items: { name: string; sku: string; image?: { url: string; alt: string } | null; variantSku?: string | null; unitPrice: number; qty: number; lineTotal: number }[];
  pricing: { subtotal: number; discount: number; shipping: number; tax: number; total: number };
  payment: { method?: string; provider?: string; status: string };
  shippingAddress: Address & { phone?: string };
};
