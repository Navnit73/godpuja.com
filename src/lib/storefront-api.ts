// Shapes returned by the cart/checkout/order endpoints (see docs/API_DOCUMENTATION.md, Stage 9).
export type CartItem = {
  productId: string; variantSku: string | null; sku: string; name: string; slug: string; image: { url: string; alt: string } | null;
  options: Record<string, string>; unitPrice: number; qty: number; lineTotal: number; available: boolean; maxQty: number; freeShipping: boolean;
};
export type CartIssue = { productId: string; variantSku: string | null; code: "unavailable" | "out_of_stock" | "reduced"; message: string };
export type CartPricing = { subtotal: number; shipping: number; total: number; freeShippingOver: number; flatShipping: number };
export type CartValidation = { items: CartItem[]; issues: CartIssue[]; pricing: CartPricing };

export type Address = { name: string; line1: string; line2?: string; city: string; state: string; pincode: string; country: "IN" };
export type CheckoutResult = { orderId: string; orderNumber: string; accessToken: string; status: string; payment: { method: string; status: string } };
export type OrderView = {
  orderNumber: string; status: string; createdAt: string; email?: string;
  items: { name: string; sku: string; image?: { url: string; alt: string } | null; variantSku?: string | null; unitPrice: number; qty: number; lineTotal: number }[];
  pricing: { subtotal: number; discount: number; shipping: number; tax: number; total: number };
  payment: { method?: string; provider?: string; status: string };
  shippingAddress: Address & { phone?: string };
};
