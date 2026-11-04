import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { addressLines } from "@/lib/address";
import { formatMoney } from "@/lib/money";
import { invoiceable, PAYMENT_STATUS_LABEL } from "@/lib/order-status";
import { ApiError } from "@/server/api";
import { requireAccount } from "@/server/auth/guard";
import { env } from "@/server/env";
import { getMyOrder } from "@/server/services/account";
import { findSiteSettings } from "@/server/services/settings";
import PrintButton from "./PrintButton";

export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false }, referrer: "no-referrer" };
const DATE = new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" });

async function Invoice({ params }: { params: PageProps<"/account/orders/[id]/invoice">["params"] }) {
  await connection(); // seller details are runtime configuration
  const { id } = await params;
  const user = await requireAccount(`/account/orders/${id}/invoice`);
  const o = await getMyOrder(String(user._id), id).catch((e) => { if (e instanceof ApiError && e.code === "NOT_FOUND") notFound(); throw e; });
  if (!invoiceable(o.status)) notFound(); // no invoice for unpaid or cancelled orders
  const e = env();
  const site = await findSiteSettings();
  const seller = e.SELLER_NAME || site.siteName;
  const sellerAddress = (e.SELLER_ADDRESS ?? "").split(/\\n|\n/).map((l) => l.trim()).filter(Boolean);
  const m = (n: number) => formatMoney(n, o.currency);
  return (
    <main id="main" tabIndex={-1} className="invoice-doc mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/account/orders/${id}`} className="btn-ghost">← Back to order</Link>
        <PrintButton />
      </div>
      <article className="panel space-y-6 p-6 sm:p-8" aria-labelledby="inv-title">
        <div className="flex flex-wrap justify-between gap-6">
          <div>
            <h1 id="inv-title" className="text-3xl font-semibold">Invoice</h1>
            <p className="mt-1 text-sm text-muted">No. {o.orderNumber}</p>
            <p className="text-sm text-muted">Date {DATE.format(new Date(o.createdAt))}</p>
          </div>
          <div className="text-sm sm:text-right">
            <p className="font-semibold">{seller}</p>
            {sellerAddress.map((l) => <p key={l} className="text-muted">{l}</p>)}
            {e.SELLER_TAX_ID && <p className="text-muted">Tax registration no. {e.SELLER_TAX_ID}</p>}
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <section aria-labelledby="bill-to">
            <h2 id="bill-to" className="mb-1 font-sans text-sm font-semibold uppercase tracking-wide text-muted">Billed to</h2>
            <address className="text-sm not-italic">{addressLines(o.billingAddress).map((l, n) => <span key={n} className="block">{l}</span>)}<span className="block text-muted">{o.email}</span></address>
          </section>
          <section aria-labelledby="ship-to">
            <h2 id="ship-to" className="mb-1 font-sans text-sm font-semibold uppercase tracking-wide text-muted">Shipped to</h2>
            <address className="text-sm not-italic">{addressLines(o.shippingAddress).map((l, n) => <span key={n} className="block">{l}</span>)}</address>
          </section>
        </div>
        <table className="data-table w-full">
          <caption className="sr-only">Items on this invoice</caption>
          <thead><tr><th scope="col">Item</th><th scope="col" className="text-right">Price</th><th scope="col" className="text-right">Qty</th><th scope="col" className="text-right">Amount</th></tr></thead>
          <tbody>
            {o.items.map((i, n) => (
              <tr key={n}>
                <td>{i.name}{Object.keys(i.options).length > 0 && <span className="text-muted"> ({Object.values(i.options).join(", ")})</span>}<span className="block text-xs text-muted">{i.sku}</span></td>
                <td className="whitespace-nowrap text-right">{m(i.unitPrice)}</td><td className="text-right">{i.qty}</td><td className="whitespace-nowrap text-right">{m(i.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{m(o.pricing.subtotal)}</dd></div>
          {o.pricing.discount > 0 && <div className="flex justify-between"><dt>Discount{o.couponCode ? ` (${o.couponCode})` : ""}</dt><dd>−{m(o.pricing.discount)}</dd></div>}
          <div className="flex justify-between"><dt>Shipping</dt><dd>{o.pricing.shipping === 0 ? "Free" : m(o.pricing.shipping)}</dd></div>
          {o.pricing.tax > 0 && <div className="flex justify-between"><dt>{o.pricing.taxName ?? "Tax"}{o.pricing.taxRateBps ? ` ${o.pricing.taxRateBps / 100}%` : ""}{o.pricing.taxInclusive === false ? " (added)" : " (included in prices)"}</dt><dd>{m(o.pricing.tax)}</dd></div>}
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><dt>Total ({o.currency})</dt><dd>{m(o.pricing.total)}</dd></div>
        </dl>
        <p className="text-sm text-muted">Payment: {o.payment.method === "cod" ? "Cash on delivery" : o.payment.method} — {PAYMENT_STATUS_LABEL[o.payment.status].toLowerCase()}. {o.pricing.taxInclusive === false && o.pricing.tax > 0 ? "Tax is added to the total." : "Prices include applicable taxes."}</p>
      </article>
    </main>
  );
}

export default function InvoicePage({ params }: PageProps<"/account/orders/[id]/invoice">) {
  return <Suspense fallback={<p role="status" className="px-4 py-12 text-muted">Loading…</p>}><Invoice params={params} /></Suspense>;
}
