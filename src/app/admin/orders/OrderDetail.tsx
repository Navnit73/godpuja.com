"use client";
/* eslint-disable @next/next/no-img-element -- admin thumbnails of remote images */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, ApiClientError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { addressLines } from "@/lib/address";
import { CARRIERS, type CarrierId } from "@/lib/carriers";
import { formatMoney as fmtMoney, rupeesToPaise } from "@/lib/money";
import type { OrderStatus } from "@/server/models/Order";
import type { AdminOrder } from "@/server/services/orders";
import { PaymentBadge, StatusBadge, STATUS_LABEL } from "./badges";

const ACTION_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Mark awaiting payment", payment_failed: "Mark payment failed", confirmed: "Confirm", processing: "Start processing", shipped: "Mark as shipped",
  delivered: "Mark as delivered", return_requested: "Record return request", returned: "Mark as returned", cancelled: "Cancel order", refunded: "Mark refunded",
};

/** Same target status, different meaning: from a return request, "returned" accepts it and "delivered" declines it. */
const actionLabel = (from: OrderStatus, to: OrderStatus) =>
  from === "return_requested" ? (to === "returned" ? "Accept return" : to === "delivered" ? "Decline return" : ACTION_LABEL[to]) : ACTION_LABEL[to];

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="card space-y-3 p-4 hover:shadow-elev-1"><h2 className="font-sans text-lg font-semibold">{title}</h2>{children}</section>
);
const Address = ({ a }: { a: AdminOrder["shippingAddress"] }) => (
  <address className="not-italic text-sm">{addressLines(a).map((l, n) => <p key={n} className={n === 0 ? "font-medium" : undefined}>{l}</p>)}</address>
);

export default function OrderDetail({ initial, canWrite, canRefund }: { initial: AdminOrder; canWrite: boolean; canRefund: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [o, setO] = useState(initial);
  const formatMoney = (minor: number) => fmtMoney(minor, o.currency);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<OrderStatus | null>(null);
  const [ship, setShip] = useState<{ carrier: CarrierId; trackingNumber: string; trackingUrl: string }>({ carrier: "delhivery", trackingNumber: "", trackingUrl: "" });
  const addShipment = async () => {
    if (await run("shipment", "Tracking added", () => api.post<AdminOrder>(`/admin/orders/${o.id}/shipments`, { carrier: ship.carrier, trackingNumber: ship.trackingNumber, ...(ship.trackingUrl ? { trackingUrl: ship.trackingUrl } : {}) }))) setShip({ ...ship, trackingNumber: "", trackingUrl: "" });
  };
  const removeShipment = (sid: string) => run("shipment", "Tracking removed", () => api.delete<AdminOrder>(`/admin/orders/${o.id}/shipments/${sid}`));
  const [statusNote, setStatusNote] = useState("");
  const [note, setNote] = useState("");
  const [refundAmt, setRefundAmt] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});

  async function run<T extends AdminOrder>(key: string, ok: string, fn: () => Promise<T>) {
    setBusy(key); setError(null); setFieldErr({});
    try { const next = await fn(); setO(next); toast(ok); router.refresh(); return true; }
    catch (e) {
      if (e instanceof ApiClientError) { setError(e.message); setFieldErr(e.fields ?? {}); } else setError("Something went wrong. Try again.");
      return false;
    } finally { setBusy(null); }
  }

  const setStatus = async (to: OrderStatus) => {
    if (await run("status", `Order marked ${STATUS_LABEL[to].toLowerCase()}`, () => api.patch<AdminOrder>(`/admin/orders/${o.id}/status`, { status: to, ...(statusNote.trim() ? { note: statusNote.trim() } : {}) }))) { setConfirm(null); setStatusNote(""); }
  };
  const setPayment = (status: "paid" | "failed") => run("payment", `Payment marked ${status}`, () => api.patch<AdminOrder>(`/admin/orders/${o.id}/payment`, { status }));
  const addNote = async () => { if (await run("note", "Note added", () => api.post<AdminOrder>(`/admin/orders/${o.id}/notes`, { text: note }))) setNote(""); };
  const refund = async () => {
    const paise = rupeesToPaise(refundAmt);
    if (paise === null || Number.isNaN(paise) || paise < 1) { setFieldErr({ amount: "Enter an amount like 199 or 199.50" }); return; }
    if (await run("refund", "Refund recorded", () => api.post<AdminOrder>(`/admin/orders/${o.id}/refund`, { amount: paise, reason: refundReason }))) { setRefundAmt(""); setRefundReason(""); }
  };

  const closed = o.status === "cancelled" || o.status === "refunded";
  const canMarkPaid = canWrite && ["pending", "failed"].includes(o.payment.status) && !closed;
  const canMarkFailed = canWrite && o.payment.status === "pending" && !closed;

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="alert-error">{error}</p>}

      <div className="card flex flex-wrap items-center gap-x-6 gap-y-3 p-4 hover:shadow-elev-1">
        <div><p className="text-xs text-muted">Status</p><StatusBadge status={o.status} /></div>
        <div><p className="text-xs text-muted">Payment</p><PaymentBadge status={o.payment.status} /></div>
        <div><p className="text-xs text-muted">Placed</p><p className="text-sm">{formatDateTime(o.createdAt)}</p></div>
        <div><p className="text-xs text-muted">Total</p><p className="text-sm font-semibold">{formatMoney(o.pricing.total)}</p></div>
        {canWrite && o.allowedNext.length > 0 && (
          <div className="ml-auto flex flex-wrap gap-2" role="group" aria-label="Change order status">
            {o.allowedNext.map((s) => s === "cancelled" || (o.status === "return_requested" && s === "delivered")
              ? <Button key={s} variant="danger" onClick={() => setConfirm(s)} disabled={!!busy}>{actionLabel(o.status, s)}</Button>
              : <Button key={s} onClick={() => setStatus(s)} loading={busy === "status"} disabled={!!busy}>{actionLabel(o.status, s)}</Button>)}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Items">
            <div className="overflow-x-auto">
              <table className="data-table">
                <caption className="sr-only">Items in this order</caption>
                <thead><tr><th scope="col">Product</th><th scope="col">SKU</th><th scope="col">Price</th><th scope="col">Qty</th><th scope="col">Line total</th></tr></thead>
                <tbody>
                  {o.items.map((i, n) => (
                    <tr key={n}>
                      <td><div className="flex items-center gap-3">
                        {i.image ? <img src={i.image.url} alt="" referrerPolicy="no-referrer" className="h-10 w-10 rounded object-cover" /> : <span className="h-10 w-10 rounded bg-sandal-100" aria-hidden="true" />}
                        <div><Link href={`/admin/products/${i.product}`} className="font-medium hover:text-primary">{i.name}</Link>
                          {Object.keys(i.options).length > 0 && <p className="text-xs text-muted">{Object.entries(i.options).map(([k, v]) => `${k}: ${v}`).join(", ")}</p>}</div>
                      </div></td>
                      <td className="text-muted">{i.sku}</td>
                      <td className="whitespace-nowrap">{formatMoney(i.unitPrice)}</td>
                      <td>{i.qty}</td>
                      <td className="whitespace-nowrap">{formatMoney(i.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="ml-auto grid max-w-xs grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Subtotal</dt><dd className="text-right">{formatMoney(o.pricing.subtotal)}</dd>
              <dt className="text-muted">Shipping</dt><dd className="text-right">{o.pricing.shipping === 0 ? "Free" : formatMoney(o.pricing.shipping)}</dd>
              <dt className="text-muted">Tax (included)</dt><dd className="text-right">{formatMoney(o.pricing.tax)}</dd>
              <dt className="font-semibold">Total</dt><dd className="text-right font-semibold">{formatMoney(o.pricing.total)}</dd>
              {o.refundedTotal > 0 && <><dt className="text-muted">Refunded</dt><dd className="text-right text-danger">−{formatMoney(o.refundedTotal)}</dd></>}
            </dl>
          </Card>

          <Card title="History">
            <ol className="space-y-3 border-l-2 border-sandal-300 pl-4">
              {[...o.history].reverse().map((h, n) => (
                <li key={n} className="text-sm">
                  <p className="font-medium">{h.kind === "status" || h.kind === "created" || h.kind === "return" ? STATUS_LABEL[h.status] : h.kind === "refund" ? "Refund" : h.kind === "payment" ? "Payment" : h.kind === "shipment" ? "Shipment" : "Payment update"}{h.note && <span className="font-normal text-muted"> — {h.note}</span>}</p>
                  <p className="text-xs text-muted">{h.by.name} · {formatDateTime(h.at)}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Customer">
            <p className="text-sm"><a href={`mailto:${o.email}`} className="text-primary underline">{o.email}</a></p>
            <p className="text-sm"><a href={`tel:${o.phone.replace(/[^\d+]/g, "")}`} className="text-primary underline">{o.phone}</a></p>
            <p className="text-xs text-muted">{o.user ? "Linked to a customer account" : "Guest order"}</p>
            {o.customerNote && <p className="rounded-md bg-sandal-100 p-2 text-sm"><span className="font-medium">Customer note: </span>{o.customerNote}</p>}
          </Card>
          {o.returnRequest && (
            <Card title="Return request">
              <p className="text-sm"><span className="badge-primary capitalize">{o.returnRequest.status}</span> <span className="text-xs text-muted">{o.returnRequest.source === "customer" ? "from the customer" : "recorded by staff"} · {formatDateTime(o.returnRequest.at)}</span></p>
              <p className="rounded-md bg-sandal-100 p-2 text-sm">{o.returnRequest.reason}</p>
              {o.returnRequest.decisionNote && <p className="text-sm"><span className="font-medium">Decision note: </span>{o.returnRequest.decisionNote}</p>}
              {o.returnRequest.status === "requested" && <p className="text-xs text-muted">Use “Accept return” or “Decline return” above. Accepting does not refund automatically: record the refund below once the goods are back.</p>}
            </Card>
          )}
          <Card title="Shipping address"><Address a={o.shippingAddress} /></Card>
          <Card title="Billing address"><Address a={o.billingAddress} /></Card>

          <Card title="Shipments & tracking">
            {o.shipments.length === 0 ? <p className="text-sm text-muted">No tracking added yet.</p> : (
              <ul className="space-y-2 text-sm">
                {o.shipments.map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-2">
                    <span>
                      <span className="font-medium">{CARRIERS.find((c) => c.id === s.carrier)?.name ?? s.carrier}</span> · {s.link ? <a href={s.link} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline">{s.trackingNumber}<span className="sr-only"> (opens in a new tab)</span></a> : <span className="break-all">{s.trackingNumber}</span>}
                      <span className="block text-xs text-muted">{s.by} · {formatDateTime(s.shippedAt)}</span>
                    </span>
                    {canWrite && <Button size="sm" variant="ghost" onClick={() => removeShipment(s.id)} disabled={!!busy} aria-label={`Remove tracking ${s.trackingNumber}`}>Remove</Button>}
                  </li>
                ))}
              </ul>
            )}
            {canWrite && ["processing", "shipped", "delivered"].includes(o.status) && (
              <form onSubmit={(e) => { e.preventDefault(); addShipment(); }} className="space-y-3 border-t border-border pt-3" noValidate>
                <div>
                  <label htmlFor="carrier" className="label">Carrier</label>
                  <select id="carrier" className="input" value={ship.carrier} onChange={(e) => setShip({ ...ship, carrier: e.target.value as CarrierId })}>{CARRIERS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                </div>
                <Input label="Tracking number" value={ship.trackingNumber} maxLength={40} error={fieldErr.trackingNumber} onChange={(e) => setShip({ ...ship, trackingNumber: e.target.value })} />
                {!CARRIERS.find((c) => c.id === ship.carrier)?.url && <Input label="Tracking page (optional https link)" value={ship.trackingUrl} maxLength={500} error={fieldErr.trackingUrl} hint="Customers get a tracking link when this is set." onChange={(e) => setShip({ ...ship, trackingUrl: e.target.value })} />}
                <Button type="submit" size="sm" loading={busy === "shipment"} disabled={!!busy}>Add tracking & email customer</Button>
              </form>
            )}
          </Card>

          <Card title="Payment">
            <p className="text-sm">Method: <span className="font-medium uppercase">{o.payment.method}</span> <PaymentBadge status={o.payment.status} /></p>
            {o.payment.paidAt && <p className="text-xs text-muted">Paid {formatDateTime(o.payment.paidAt)}</p>}
            {o.payment.providerPaymentId && <p className="break-all text-xs text-muted">Reference: {o.payment.providerPaymentId}</p>}
            {(canMarkPaid || canMarkFailed) && (
              <div className="flex flex-wrap gap-2">
                {canMarkPaid && <Button size="sm" onClick={() => setPayment("paid")} loading={busy === "payment"} disabled={!!busy}>Mark as paid</Button>}
                {canMarkFailed && <Button size="sm" variant="outline" onClick={() => setPayment("failed")} disabled={!!busy}>Mark as failed</Button>}
              </div>
            )}
            {canRefund && o.refundable > 0 && (
              <form className="space-y-3 border-t border-border pt-3" onSubmit={(e) => { e.preventDefault(); refund(); }} noValidate>
                <h3 className="font-sans text-sm font-semibold">Record a refund</h3>
                <p className="text-xs text-muted">Up to {formatMoney(o.refundable)}. This records the refund here; no money is moved automatically.</p>
                <Input label={`Amount (${o.currency})`} inputMode="decimal" value={refundAmt} error={fieldErr.amount} onChange={(e) => setRefundAmt(e.target.value)} />
                <Input label="Reason" value={refundReason} error={fieldErr.reason} maxLength={300} onChange={(e) => setRefundReason(e.target.value)} />
                <Button type="submit" variant="outline" size="sm" loading={busy === "refund"} disabled={!!busy}>Record refund</Button>
              </form>
            )}
            {o.refunds.length > 0 && (
              <ul className="space-y-1 border-t border-border pt-3 text-sm">
                {o.refunds.map((r, n) => <li key={n}>{formatMoney(r.amount)} — {r.reason}<span className="block text-xs text-muted">{r.by.name} · {formatDateTime(r.at)}</span></li>)}
              </ul>
            )}
          </Card>
          <Card title="Ledger">
            {o.ledger.length === 0 ? <p className="text-sm text-muted">No money recorded yet.</p> : (
              <ul className="space-y-2 text-sm">
                {o.ledger.map((l) => (
                  <li key={l.id} className="flex justify-between gap-3">
                    <span><span className="font-medium capitalize">{l.type}</span> · {l.method.toUpperCase()}{l.providerRef && <span className="block break-all text-xs text-muted">{l.providerRef}</span>}<span className="block text-xs text-muted">{l.by} · {formatDateTime(l.at)}</span></span>
                    <span className={l.type === "refund" ? "text-danger" : ""}>{l.type === "refund" ? "−" : ""}{fmtMoney(l.amount, l.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted">Every charge and refund is recorded here and can never be edited.</p>
          </Card>

          <Card title="Internal notes">
            <p className="text-xs text-muted">Only staff can see these.</p>
            {o.notes.length > 0 && (
              <ul className="space-y-2">
                {o.notes.map((n, i) => <li key={i} className="rounded-md bg-sandal-100 p-2 text-sm"><p className="whitespace-pre-wrap">{n.text}</p><p className="text-xs text-muted">{n.by.name} · {formatDateTime(n.at)}</p></li>)}
              </ul>
            )}
            {canWrite && (
              <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (note.trim()) addNote(); }}>
                <label htmlFor="order-note" className="label">Add a note</label>
                <textarea id="order-note" rows={3} maxLength={1000} className="input h-auto py-2" value={note} onChange={(e) => setNote(e.target.value)} />
                <Button type="submit" variant="outline" size="sm" loading={busy === "note"} disabled={!note.trim() || !!busy}>Add note</Button>
              </form>
            )}
          </Card>
        </div>
      </div>

      <Modal open={confirm === "delivered"} onClose={() => setConfirm(null)} title="Decline this return?">
        <p className="text-sm text-muted">The order goes back to delivered and the customer is emailed the decision. They cannot request this return again.</p>
        <div className="mt-4"><Input label="Note for the customer (optional)" value={statusNote} maxLength={500} onChange={(e) => setStatusNote(e.target.value)} /></div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => setStatus("delivered")} loading={busy === "status"}>Decline return</Button>
        </div>
      </Modal>

      <Modal open={confirm === "cancelled"} onClose={() => setConfirm(null)} title="Cancel this order?">
        <p className="text-sm text-muted">The items go back into stock. If the customer already paid, record a refund afterwards. This cannot be undone.</p>
        <div className="mt-4"><Input label="Reason (optional)" value={statusNote} maxLength={500} onChange={(e) => setStatusNote(e.target.value)} /></div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirm(null)}>Keep order</Button>
          <Button variant="danger" onClick={() => setStatus("cancelled")} loading={busy === "status"}>Cancel order</Button>
        </div>
      </Modal>
    </div>
  );
}
