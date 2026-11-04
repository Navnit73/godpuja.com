"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { api, ApiClientError } from "@/lib/api";
import type { OrderActions as Actions } from "@/server/services/fulfilment";

const DATE = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

/** Cancel (before processing) and request a return (within the return period, once). The server decides; this only offers what it allows. */
export default function OrderActions({ id, actions, delivered, hasReturn }: { id: string; actions: Actions; delivered: boolean; hasReturn: boolean }) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();

  async function run(key: string, fn: () => Promise<unknown>, done: () => void) {
    setBusy(key); setError(null); setFieldError(undefined);
    try { await fn(); done(); router.refresh(); }
    catch (e) {
      if (e instanceof ApiClientError) { setError(e.fields ? null : e.message); setFieldError(e.fields?.reason); } else setError("Something went wrong. Try again.");
    } finally { setBusy(null); }
  }

  return (
    <section aria-labelledby="actions" className="panel space-y-3 p-5">
      <h2 id="actions" className="font-sans text-lg font-semibold">Need to change something?</h2>
      {error && !cancelOpen && !returnOpen && <p role="alert" className="alert-error">{error}</p>}
      {actions.canCancel && <div><button type="button" className="btn-outline" onClick={() => { setError(null); setCancelOpen(true); }}>Cancel this order</button><p className="mt-1 text-xs text-muted">Possible until we start preparing it. If you paid online, the refund follows our refund policy.</p></div>}
      {actions.canReturn && <div><button type="button" className="btn-outline" onClick={() => { setError(null); setFieldError(undefined); setReturnOpen(true); }}>Request a return</button>{actions.returnDeadline && <p className="mt-1 text-xs text-muted">You can request a return until {DATE.format(new Date(actions.returnDeadline))}.</p>}</div>}
      {!actions.canCancel && !actions.canReturn && <p className="text-sm text-muted">{delivered && !hasReturn ? "The return period for this order has ended. Please contact us if you need help." : "Nothing can be changed online for this order now. Please contact us if you need help."}</p>}

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this order?">
        <p className="text-sm text-muted">The items go back into stock and this cannot be undone.</p>
        {error && <p role="alert" className="alert-error mt-3">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={() => setCancelOpen(false)}>Keep order</button>
          <button type="button" className="btn-primary" disabled={busy === "cancel"} onClick={() => run("cancel", () => api.post(`/account/orders/${id}/cancel`), () => setCancelOpen(false))}>{busy === "cancel" ? "Cancelling…" : "Cancel order"}</button>
        </div>
      </Modal>

      <Modal open={returnOpen} onClose={() => setReturnOpen(false)} title="Request a return">
        <form onSubmit={(e) => { e.preventDefault(); run("return", () => api.post(`/account/orders/${id}/return`, { reason }), () => { setReturnOpen(false); setReason(""); }); }} noValidate className="space-y-3">
          {error && <p role="alert" className="alert-error">{error}</p>}
          <div>
            <label htmlFor="return-reason" className="label">Why are you returning it?</label>
            <textarea id="return-reason" rows={4} maxLength={500} className="input h-auto py-2" value={reason} aria-invalid={!!fieldError} aria-describedby={fieldError ? "return-reason-err" : undefined} onChange={(e) => setReason(e.target.value)} />
            {fieldError && <p id="return-reason-err" className="field-error">{fieldError}</p>}
          </div>
          <p className="text-xs text-muted">We will review it and email you. Please keep the items and packaging until then. You can request a return only once per order.</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setReturnOpen(false)}>Close</button>
            <button type="submit" className="btn-primary" disabled={busy === "return"}>{busy === "return" ? "Sending…" : "Send request"}</button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
