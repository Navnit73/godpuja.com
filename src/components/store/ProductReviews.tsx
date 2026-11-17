import { STARS } from "@/lib/rating";
import { findPublicReviews } from "@/server/services/reviews";
import ReviewForm from "./ReviewForm";
import Stars from "./Stars";

const DATE = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

/** Published, verified-purchase reviews with the star breakdown; the form to write one is in the browser (it depends on who is signed in). */
export default async function ProductReviews({ productId, slug }: { productId: string; slug: string }) {
  const { items, summary } = await findPublicReviews(productId);
  return (
    <section aria-labelledby="reviews" className="mt-16 grid gap-6 border-t border-sandal-200 pt-12 sm:mt-20 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-14">
      <h2 id="reviews" className="section-title text-2xl sm:text-3xl">Customer reviews</h2>
      <div className="max-w-3xl">
      {summary.count > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <div>
            <p className="font-display text-5xl font-extrabold">{Number.isInteger(summary.avg) ? summary.avg : summary.avg.toFixed(1)}<span className="text-lg text-muted"> / 5</span></p>
            <Stars avg={summary.avg} count={summary.count} showCount={false} />
            <p className="mt-1 text-sm text-muted">{summary.count} {summary.count === 1 ? "review" : "reviews"}</p>
          </div>
          <dl className="min-w-48 flex-1 space-y-1 text-sm" aria-label="Reviews by star rating">
            {[...STARS].reverse().map((s) => (
              <div key={s} className="flex items-center gap-2">
                <dt className="w-12 shrink-0">{s} {s === 1 ? "star" : "stars"}</dt>
                <dd className="flex flex-1 items-center gap-2">
                  <span className="h-2 flex-1 overflow-hidden rounded-sm bg-sandal-200" aria-hidden="true"><span className="block h-full bg-gold-500" style={{ width: `${(summary.distribution[s] / summary.count) * 100}%` }} /></span>
                  <span className="w-6 text-right text-muted">{summary.distribution[s]}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : <p className="mt-3 text-sm text-muted">No reviews yet.</p>}

      {items.length > 0 && (
        <ul className="mt-6 divide-y divide-sandal-200">
          {items.map((r) => (
            <li key={r.id} className="py-4">
              <Stars avg={r.rating} count={1} showCount={false} />
              {r.title && <h3 className="mt-1 font-display text-base font-bold">{r.title}</h3>}
              <p className="mt-1 whitespace-pre-line text-sm">{r.body}</p>
              <p className="mt-2 text-xs text-muted">{r.displayName} · {DATE.format(new Date(r.createdAt))} · Verified purchase</p>
            </li>
          ))}
        </ul>
      )}
      <ReviewForm slug={slug} />
      </div>
    </section>
  );
}
