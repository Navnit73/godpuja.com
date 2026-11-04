"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { addressLines } from "@/lib/address";
import { carrierName } from "@/lib/carriers";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, type OrderStatus, type PaymentStatus } from "@/lib/order-status";
import type { OrderView } from "@/lib/storefront-api";

export default function ConfirmationClient() {
  const { id } = useParams<{ id: string }>();
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<{ order?: OrderView; error?: string; done: boolean }>({ done: false });

  useEffect(() => {
    let live = true;
    if (!/^[a-f0-9]{24}$/.test(id) || !token) { Promise.resolve().then(() => live && setState({ done: true, error: "We could not find this order." })); return; }
    api.get<OrderView>(`/orders/${id}?token=${encodeURIComponent(token)}`)
      .then((order) => live && setState({ done: true, order }))
      .catch((e) => live && setState({ done: true, error: e instanceof ApiClientError && e.status === 404 ? "We could not find this order. Check the link in your confirmation." : "Could not load your order. Please refresh." }));
    return () => { live = false; };
  }, [id, token]);

  if (!state.done) return <p role="status" className="text-muted">Loading your order…</p>;
  if (state.error || !state.order) return <div role="alert" className="alert-error">{state.error}</div>;
  const o = state.order;
  const a = o.shippingAddress;
  const money = (n: number) => formatMoney(n, o.currency);
  const status = ORDER_STATUS_LABEL[o.status as OrderStatus]?.toLowerCase() ?? o.status.replace(/_/g, " ");
  const awaiting = o.status === "pending_payment" || o.status === "payment_failed";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-semibold">{awaiting ? "Your order is waiting for payment" : "Thank you for your order"}</h1>
        <p className="mt-2 text-muted">Order <strong className="text-foreground">{o.orderNumber}</strong> is {status}.{awaiting && " It is not confirmed until the payment succeeds."} Keep this page link to check it later.</p>
      </div>
      <section aria-labelledby="items" className="panel p-5">
        <h2 id="items" className="mb-3 font-sans text-lg font-semibold">Items</h2>
        <ul className="divide-y divide-border">
          {o.items.map((i, n) => (
            <li key={n} className="flex justify-between gap-3 py-2 text-sm"><span>{i.name} × {i.qty}</span><span>{money(i.lineTotal)}</span></li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(o.pricing.subtotal)}</dd></div>
          <div className="flex justify-between"><dt>Shipping</dt><dd>{o.pricing.shipping === 0 ? "Free" : money(o.pricing.shipping)}</dd></div>
          <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd>{money(o.pricing.total)}</dd></div>
        </dl>
      </section>
      <section aria-labelledby="ship" className="panel p-5">
        <h2 id="ship" className="mb-2 font-sans text-lg font-semibold">Delivery</h2>
        <address className="text-sm not-italic text-muted">{addressLines(a).map((l, n) => <span key={n} className="block">{l}</span>)}</address>
        <p className="mt-3 text-sm">Payment: <strong>{(o.payment.method ?? o.payment.provider ?? "").toUpperCase() === "COD" ? "Cash on delivery" : o.payment.method ?? o.payment.provider}</strong> — {PAYMENT_STATUS_LABEL[o.payment.status as PaymentStatus]?.toLowerCase() ?? o.payment.status}</p>
      </section>
      {o.shipments && o.shipments.length > 0 && (
        <section aria-labelledby="tracking" className="panel p-5">
          <h2 id="tracking" className="mb-2 font-sans text-lg font-semibold">Tracking</h2>
          <ul className="space-y-1 text-sm">
            {o.shipments.map((s) => (
              <li key={s.id}>{carrierName(s.carrier)} · {s.link
                ? <a href={s.link} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline">{s.trackingNumber}<span className="sr-only"> (opens in a new tab)</span></a>
                : <span className="break-all">{s.trackingNumber}</span>}</li>
            ))}
          </ul>
        </section>
      )}
      <Link href="/" className="btn-primary">Continue shopping</Link>
    </div>
  );
}
