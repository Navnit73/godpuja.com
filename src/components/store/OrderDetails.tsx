import { addressLines } from "@/lib/address";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/order-status";
import type { CustomerOrder } from "@/server/services/orders";

const DATE = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

/** Customer-facing order detail (account pages). Same information as the token confirmation page. */
export default function OrderDetails({ o }: { o: CustomerOrder }) {
  const money = (n: number) => formatMoney(n, o.currency);
  const awaiting = o.status === "pending_payment" || o.status === "payment_failed";
  return (
    <div className="space-y-6">
      <div className="panel flex flex-wrap gap-x-8 gap-y-2 p-5 text-sm">
        <p><span className="text-muted">Order </span><strong>{o.orderNumber}</strong></p>
        <p><span className="text-muted">Placed </span>{DATE.format(new Date(o.createdAt))}</p>
        <p><span className="text-muted">Status </span><strong>{ORDER_STATUS_LABEL[o.status]}</strong></p>
        <p><span className="text-muted">Payment </span>{o.payment.method === "cod" ? "Cash on delivery" : o.payment.method} — {PAYMENT_STATUS_LABEL[o.payment.status].toLowerCase()}</p>
      </div>
      {awaiting && <p className="alert-error">This order is not confirmed until the payment succeeds.</p>}
      <section aria-labelledby="items" className="panel p-5">
        <h2 id="items" className="mb-3 font-sans text-lg font-semibold">Items</h2>
        <ul className="divide-y divide-border">
          {o.items.map((i, n) => (
            <li key={n} className="flex justify-between gap-3 py-2 text-sm">
              <span>{i.name}{Object.keys(i.options).length > 0 && <span className="text-muted"> ({Object.values(i.options).join(", ")})</span>} × {i.qty}</span>
              <span>{money(i.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(o.pricing.subtotal)}</dd></div>
          <div className="flex justify-between"><dt>Shipping</dt><dd>{o.pricing.shipping === 0 ? "Free" : money(o.pricing.shipping)}</dd></div>
          <div className="flex justify-between text-base font-semibold"><dt>Total ({o.currency})</dt><dd>{money(o.pricing.total)}</dd></div>
        </dl>
      </section>
      <div className="grid gap-6 sm:grid-cols-2">
        <section aria-labelledby="ship" className="panel p-5">
          <h2 id="ship" className="mb-2 font-sans text-lg font-semibold">Delivery address</h2>
          <address className="text-sm not-italic text-muted">{addressLines(o.shippingAddress).map((l, n) => <span key={n} className="block">{l}</span>)}</address>
        </section>
        <section aria-labelledby="bill" className="panel p-5">
          <h2 id="bill" className="mb-2 font-sans text-lg font-semibold">Billing address</h2>
          <address className="text-sm not-italic text-muted">{addressLines(o.billingAddress).map((l, n) => <span key={n} className="block">{l}</span>)}</address>
        </section>
      </div>
    </div>
  );
}
