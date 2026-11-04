import { handle, ok } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { listReviews } from "@/server/services/reviews";
import { listReviewsSchema } from "@/lib/validation/reviews";

export const GET = handle(async (req) => {
  await requireUser("reviews:write");
  const q = listReviewsSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const r = await listReviews(q);
  return ok(r.items, { meta: { total: r.total, page: r.page, limit: r.limit, pages: r.pages } });
});
