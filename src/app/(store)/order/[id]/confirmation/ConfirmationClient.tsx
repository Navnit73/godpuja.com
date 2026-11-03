"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { formatPaise } from "@/lib/money";
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
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-semibold">Thank you for your order</h1>
        <p className="mt-2 text-muted">Order <strong className="text-foreground">{o.orderNumber}</strong> is {o.status.replace(/_/g, " ")}. Keep this page link to check it later.</p>
      </div>
      <section aria-labelledby="items" className="panel p-5">
        <h2 id="items" className="mb-3 font-sans text-lg font-semibold">Items</h2>
        <ul className="divide-y divide-border">
          {o.items.map((i, n) => (
            <li key={n} className="flex justify-between gap-3 py-2 text-sm"><span>{i.name} × {i.qty}</span><span>{formatPaise(i.lineTotal)}</span></li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPaise(o.pricing.subtotal)}</dd></div>
          <div className="flex justify-between"><dt>Shipping</dt><dd>{o.pricing.shipping === 0 ? "Free" : formatPaise(o.pricing.shipping)}</dd></div>
          <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd>{formatPaise(o.pricing.total)}</dd></div>
        </dl>
      </section>
      <section aria-labelledby="ship" className="panel p-5">
        <h2 id="ship" className="mb-2 font-sans text-lg font-semibold">Delivery</h2>
        <address className="text-sm not-italic text-muted">{a.name}<br />{a.line1}{a.line2 && <>, {a.line2}</>}<br />{a.city}, {a.state} {a.pincode}</address>
        <p className="mt-3 text-sm">Payment: <strong>{(o.payment.method ?? o.payment.provider ?? "").toUpperCase() === "COD" ? "Cash on delivery" : o.payment.method ?? o.payment.provider}</strong> — {o.payment.status}</p>
      </section>
      <Link href="/" className="btn-primary">Continue shopping</Link>
    </div>
  );
}
