import { formatMoney } from "@/lib/money";
import { rateLabel } from "@/lib/pricing";

export type PricingView = {
  currency: string; subtotal: number; discount: number; shipping: number; tax: number; total: number;
  taxName?: string | null; taxRateBps?: number; taxInclusive?: boolean;
};

/**
 * The money lines of an order or cart, in one place so the cart, checkout, confirmation and account all agree:
 * items, discount (with the code), shipping, tax (included or added) and the total in its currency.
 */
export default function PricingLines({ p, couponCode }: { p: PricingView; couponCode?: string | null }) {
  const m = (n: number) => formatMoney(n, p.currency);
  const taxed = !!p.taxName && p.tax > 0;
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between"><dt>Subtotal</dt><dd>{m(p.subtotal)}</dd></div>
      {p.discount > 0 && <div className="flex justify-between text-success"><dt>Discount{couponCode ? ` (${couponCode})` : ""}</dt><dd>−{m(p.discount)}</dd></div>}
      <div className="flex justify-between"><dt>Shipping</dt><dd>{p.shipping === 0 ? "Free" : m(p.shipping)}</dd></div>
      {taxed && <div className="flex justify-between"><dt>{p.taxName}{p.taxRateBps ? ` ${rateLabel(p.taxRateBps)}` : ""}{p.taxInclusive ? " (included)" : ""}</dt><dd>{m(p.tax)}</dd></div>}
      <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><dt>Total ({p.currency})</dt><dd>{m(p.total)}</dd></div>
    </dl>
  );
}
