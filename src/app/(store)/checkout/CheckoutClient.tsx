"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ApiClientError } from "@/lib/api";
import { cart } from "@/lib/cart";
import { formatMoney } from "@/lib/money";
import type { Address, CheckoutResult } from "@/lib/storefront-api";
import AddressFields, { TextField as Field, type Country } from "@/components/store/AddressFields";
import { useValidatedCart } from "../cart/CartClient";

export type CheckoutAccount = { email: string; phone: string; name: string; addresses: (Address & { id: string; label: string; phone: string; isDefault: boolean })[] };
const blank = (country: string): Address => ({ name: "", line1: "", line2: "", city: "", state: "", postalCode: "", country });
const currencyName = (code: string) => { try { return new Intl.DisplayNames(["en"], { type: "currency" }).of(code) ?? code; } catch { return code; } };
const strip = ({ name, line1, line2, city, state, postalCode, country }: Address): Address => ({ name, line1, line2: line2 ?? "", city, state, postalCode, country });

export default function CheckoutClient({ shipTo, billTo, account }: { shipTo: Country[]; billTo: Country[]; account: CheckoutAccount | null }) {
  const router = useRouter();
  const home = shipTo[0]?.code ?? "IN";
  const { lines, loading, data, error } = useValidatedCart();
  // Signed in: start from the account's contact details and default address we can deliver to.
  const usable = (account?.addresses ?? []).filter((a) => shipTo.some((c) => c.code === a.country));
  const first = usable.find((a) => a.isDefault) ?? usable[0];
  const [email, setEmail] = useState(account?.email ?? "");
  const [phone, setPhone] = useState(first?.phone || account?.phone || "");
  const [savedId, setSavedId] = useState(first?.id ?? "");
  const [saveAddress, setSaveAddress] = useState(false);
  const [ship, setShip] = useState<Address>(() => (first ? strip(first) : { ...blank(home), name: account?.name ?? "" }));
  const [same, setSame] = useState(true);
  const [bill, setBill] = useState<Address>(() => blank(home));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  // One key per attempt-set: a retry after a network error returns the SAME order instead of creating a second one.
  const idem = useRef<string | null>(null);
  // After the server reports field errors, move focus to the first invalid field (WCAG 3.3.1 / keyboard users).
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (Object.keys(errs).length) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errs]);

  if (lines.length === 0) {
    return <div className="panel px-6 py-16 text-center"><p className="text-lg font-semibold">Your cart is empty</p><Link href="/" className="btn-primary mt-5">Continue shopping</Link></div>;
  }
  if (error) return <p role="alert" className="alert-error">{error}</p>;
  if (loading || !data) return <p role="status" className="text-muted">Loading…</p>;
  const buyable = data.items.filter((i) => i.available);
  if (buyable.length === 0) return <div className="panel px-6 py-16 text-center"><p className="text-lg font-semibold">Nothing in your cart can be purchased right now</p><Link href="/cart" className="btn-primary mt-5">Back to cart</Link></div>;

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setGeneral(null); setErrs({}); setBusy(true);
    idem.current ??= crypto.randomUUID();
    const body = {
      items: buyable.map((i) => ({ productId: i.productId, variantSku: i.variantSku ?? undefined, qty: i.qty })),
      email, phone, shippingAddress: { ...ship, line2: ship.line2 || undefined }, billingSameAsShipping: same,
      ...(same ? {} : { billingAddress: { ...bill, line2: bill.line2 || undefined } }), paymentMethod: "cod", notes: notes || undefined,
      ...(account && !savedId && saveAddress ? { saveAddress: true } : {}),
    };
    try {
      const res = await fetch("/api/checkout", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "Idempotency-Key": idem.current }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const e = json?.error;
        if (e?.fields) setErrs(e.fields);
        if (res.status === 409 || res.status === 400 && !e?.fields) idem.current = null; // changed cart/stock => next attempt is a new order
        throw new ApiClientError(e?.code ?? "INTERNAL", e?.message ?? "Checkout failed", res.status, e?.fields);
      }
      const r = json.data as CheckoutResult;
      cart.clear();
      router.replace(`/order/${r.orderId}/confirmation?token=${encodeURIComponent(r.accessToken)}`);
    } catch (e) {
      setGeneral(e instanceof ApiClientError ? (e.fields ? "Please fix the highlighted fields." : e.message) : "We could not reach the server. Please try again — you will not be charged twice.");
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-8">
        {general && <p role="alert" className="alert-error">{general}</p>}
        {data.issues.length > 0 && <ul role="status" className="alert-error space-y-1">{data.issues.map((i, n) => <li key={n}>{i.message}</li>)}</ul>}

        <fieldset className="space-y-4"><legend className="mb-2 font-sans text-xl font-semibold">Contact</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="email" label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} error={errs.email} />
            <Field id="phone" label="Mobile number" type="tel" autoComplete="tel" value={phone} onChange={setPhone} error={errs.phone} />
          </div>
        </fieldset>

        <fieldset className="space-y-4"><legend className="mb-2 font-sans text-xl font-semibold">Shipping address</legend>
          {usable.length > 0 && (
            <div>
              <label htmlFor="saved-address" className="label">Saved addresses</label>
              <select id="saved-address" className="input" value={savedId} onChange={(e) => {
                const a = usable.find((x) => x.id === e.target.value);
                setSavedId(e.target.value);
                setShip(a ? strip(a) : { ...blank(home), name: account?.name ?? "" });
                if (a?.phone) setPhone(a.phone);
              }}>
                {usable.map((a) => <option key={a.id} value={a.id}>{a.label ? `${a.label} — ` : ""}{a.name}, {a.line1}, {a.city}</option>)}
                <option value="">Use a new address</option>
              </select>
            </div>
          )}
          <AddressFields prefix="shippingAddress" a={ship} set={(a) => { setShip(a); setSavedId(""); }} errs={errs} countries={shipTo} note="we currently deliver only here" />
          {account && !savedId && (
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} /> Save this address to my account</label>
          )}
        </fieldset>

        <fieldset className="space-y-4"><legend className="mb-2 font-sans text-xl font-semibold">Billing address</legend>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={same} onChange={(e) => setSame(e.target.checked)} /> Same as shipping address</label>
          {!same && <AddressFields prefix="billingAddress" a={bill} set={setBill} errs={errs} countries={billTo} />}
        </fieldset>

        <fieldset className="space-y-3"><legend className="mb-2 font-sans text-xl font-semibold">Payment</legend>
          <label className="flex items-start gap-3 rounded-lg border border-primary p-3 text-sm"><input type="radio" name="pay" defaultChecked readOnly className="mt-1" />
            <span><span className="font-medium">Cash on delivery</span><br /><span className="text-muted">Pay in cash when your order arrives. Online payment will be available soon.</span></span></label>
        </fieldset>

        <div>
          <label htmlFor="notes" className="label">Order notes (optional)</label>
          <textarea id="notes" rows={3} maxLength={300} className="input h-auto py-2" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      <aside aria-labelledby="summary" className="panel h-fit space-y-3 p-5">
        <h2 id="summary" className="font-sans text-lg font-semibold">Order summary</h2>
        <ul className="space-y-1 text-sm">{buyable.map((i) => <li key={`${i.productId}:${i.variantSku}`} className="flex justify-between gap-3"><span>{i.name} × {i.qty}</span><span>{formatMoney(i.lineTotal, data.pricing.currency)}</span></li>)}</ul>
        <dl className="space-y-2 border-t border-border pt-3 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(data.pricing.subtotal, data.pricing.currency)}</dd></div>
          <div className="flex justify-between"><dt>Shipping</dt><dd>{data.pricing.shipping === 0 ? "Free" : formatMoney(data.pricing.shipping, data.pricing.currency)}</dd></div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatMoney(data.pricing.total, data.pricing.currency)}</dd></div>
        </dl>
        {/* PRD v1.1 §5.4 / §13: state the transaction currency before the customer commits. */}
        <p className="text-xs text-muted">You pay in {currencyName(data.pricing.currency)} ({data.pricing.currency}). Prices include all taxes.</p>
        <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? "Placing order…" : "Place order"}</button>
        <Link href="/cart" className="btn-ghost w-full">Back to cart</Link>
      </aside>
    </form>
  );
}
