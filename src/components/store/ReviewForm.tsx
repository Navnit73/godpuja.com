"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { STARS } from "@/lib/rating";
import type { MyReview, ReviewState } from "@/server/services/reviews";

type View = { kind: "loading" } | { kind: "out" } | { kind: "ineligible" } | { kind: "ready"; review: MyReview | null };

/**
 * Write, change or delete your own review. Only people with a delivered order see the form; every review (and every
 * change) waits for approval before it shows or counts, and the page says so.
 */
export default function ReviewForm({ slug }: { slug: string }) {
  const path = usePathname();
  const [view, setView] = useState<View>({ kind: "loading" });
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ rating: 0, title: "", body: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  useEffect(() => {
    let live = true;
    api.get<ReviewState>(`/account/reviews/${slug}`)
      .then((s) => { if (!live) return; setView(s.eligible ? { kind: "ready", review: s.review } : { kind: "ineligible" }); if (s.review) setF({ rating: s.review.rating, title: s.review.title, body: s.review.body }); })
      .catch((e) => live && setView(e instanceof ApiClientError && e.status === 401 ? { kind: "out" } : { kind: "ineligible" }));
    return () => { live = false; };
  }, [slug]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null); setErrs({}); setDone("");
    try {
      const r = await api.put<MyReview>(`/account/reviews/${slug}`, f);
      setView({ kind: "ready", review: r }); setEditing(false);
      setDone("Thank you. Your review will appear once our team has read it.");
    } catch (err) {
      if (err instanceof ApiClientError) { setErrs(err.fields ?? {}); setError(err.fields ? "Please fix the highlighted fields." : err.message); } else setError("Could not save your review. Try again.");
    } finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setError(null);
    try { await api.delete(`/account/reviews/${slug}`); setView({ kind: "ready", review: null }); setF({ rating: 0, title: "", body: "" }); setEditing(false); setDone("Your review was deleted."); }
    catch { setError("Could not delete your review. Try again."); } finally { setBusy(false); }
  }

  if (view.kind === "loading") return null;
  if (view.kind === "out") return <p className="mt-6 text-sm text-muted"><Link href={`/login?next=${encodeURIComponent(path)}`} className="font-medium text-primary underline">Sign in</Link> to review products you have bought.</p>;
  if (view.kind === "ineligible") return <p className="mt-6 text-sm text-muted">Only customers who have received this product can review it.</p>;

  const mine = view.review;
  const STATUS: Record<string, string> = { pending: "Waiting for review by our team. It is not shown yet.", published: "Published.", rejected: "Not published. You can edit it and send it again." };
  return (
    <div className="mt-6 rounded-xl border border-sandal-200 bg-surface p-4 sm:p-5">
      {done && <p role="status" className="alert-success mb-3">{done}</p>}
      {mine && !editing ? (
        <div className="space-y-2">
          <h3 className="font-sans text-base font-semibold">Your review</h3>
          <p className="text-sm">{mine.rating} {mine.rating === 1 ? "star" : "stars"}{mine.title && <> · <strong>{mine.title}</strong></>}</p>
          <p className="whitespace-pre-line text-sm">{mine.body}</p>
          <p className="text-xs text-muted">{STATUS[mine.status]}{mine.status === "published" && " Editing it sends it for review again."}</p>
          {error && <p role="alert" className="alert-error">{error}</p>}
          <div className="flex gap-2"><button type="button" className="btn-outline btn-sm" onClick={() => { setDone(""); setEditing(true); }}>Edit</button><button type="button" className="btn-ghost btn-sm text-danger" onClick={remove} disabled={busy}>Delete</button></div>
        </div>
      ) : (
        <form onSubmit={save} noValidate className="space-y-3" aria-labelledby="write-review">
          <h3 id="write-review" className="font-sans text-base font-semibold">{mine ? "Edit your review" : "Write a review"}</h3>
          {error && <p role="alert" className="alert-error">{error}</p>}
          <fieldset>
            <legend className="label">Your rating</legend>
            <div className="flex flex-wrap gap-2">
              {STARS.map((s) => (
                <label key={s} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${f.rating === s ? "border-primary bg-saffron-50 text-primary" : "border-input-border"}`}>
                  <input type="radio" name="rating" value={s} checked={f.rating === s} onChange={() => setF({ ...f, rating: s })} className="sr-only" />{s} {s === 1 ? "star" : "stars"}
                </label>
              ))}
            </div>
            {errs.rating && <p className="field-error">{errs.rating}</p>}
          </fieldset>
          <div>
            <label htmlFor="review-title" className="label">Headline (optional)</label>
            <input id="review-title" className="input" maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} aria-invalid={!!errs.title} />
            {errs.title && <p className="field-error">{errs.title}</p>}
          </div>
          <div>
            <label htmlFor="review-body" className="label">Your review</label>
            <textarea id="review-body" rows={4} maxLength={2000} className="input h-auto py-2" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} aria-invalid={!!errs.body} aria-describedby={errs.body ? "review-body-err" : undefined} />
            {errs.body && <p id="review-body-err" className="field-error">{errs.body}</p>}
          </div>
          <p className="text-xs text-muted">Reviews are read by our team before they appear. Your name is shown as your first name and last initial.</p>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Sending…" : mine ? "Save and send for review" : "Send review"}</button>
            {mine && <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>}
          </div>
        </form>
      )}
    </div>
  );
}
