import type { Metadata } from "next";
import Link from "next/link";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { listReviews } from "@/server/services/reviews";
import { listReviewsSchema, REVIEW_STATUSES } from "@/lib/validation/reviews";
import ReviewsClient from "./ReviewsClient";

export const metadata: Metadata = { title: "Reviews" };

export default async function ReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  const user = await currentUser();
  if (!user || !can(user.role, "reviews:write")) return <Forbidden />;
  const raw = await searchParams;
  const q = listReviewsSchema.parse({ status: typeof raw.status === "string" ? raw.status : undefined, page: typeof raw.page === "string" ? raw.page : undefined });
  const r = await listReviews(q);
  const href = (status: string, page = 1) => `/admin/reviews?status=${status}${page > 1 ? `&page=${page}` : ""}`;
  return (
    <>
      <PageHeader title="Reviews" description="Customers' verified-purchase reviews. Nothing is shown on the site, or counted in a rating, until you publish it." />
      <nav aria-label="Review status" className="mb-4 flex gap-2">
        {REVIEW_STATUSES.map((s) => <Link key={s} href={href(s)} aria-current={s === q.status ? "page" : undefined} className={`btn-sm capitalize ${s === q.status ? "btn-primary" : "btn-outline"}`}>{s}</Link>)}
      </nav>
      <ReviewsClient key={`${q.status}-${q.page}`} initial={r.items} status={q.status} />
      {r.pages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          <p className="text-muted">Page {r.page} of {r.pages} · {r.total} reviews</p>
          <div className="flex gap-2">
            {r.page > 1 && <Link className="btn-outline btn-sm" href={href(q.status, r.page - 1)}>Previous</Link>}
            {r.page < r.pages && <Link className="btn-outline btn-sm" href={href(q.status, r.page + 1)}>Next</Link>}
          </div>
        </nav>
      )}
    </>
  );
}
