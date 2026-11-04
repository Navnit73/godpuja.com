import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { invalidateProducts } from "@/server/public/catalog";
import { rateLimitShared } from "@/server/rate-limit";
import { deleteMyReview, getReviewState, saveMyReview } from "@/server/services/reviews";
import { reviewSchema } from "@/lib/validation/reviews";

type Ctx = RouteContext<"/api/account/reviews/[slug]">;

/** Can this customer review the product, and what did they write already? */
export const GET = handle(async (_req, ctx: Ctx) => {
  const user = await requireUser();
  return ok(await getReviewState(String(user._id), (await ctx.params).slug));
});

// Create or change the customer's review (always lands as "pending" for moderation).
export const PUT = handle(async (req, ctx: Ctx) => {
  const user = await requireUser();
  await rateLimitShared(`review:${String(user._id)}`, 10, 60 * 60_000);
  const input = reviewSchema.parse(await readJson(req));
  const r = await saveMyReview(String(user._id), user.name, (await ctx.params).slug, input);
  invalidateProducts(r.slug); // an edited published review leaves the rating until it is approved again
  return ok(r.review, { status: r.created ? 201 : 200 });
});

export const DELETE = handle(async (_req, ctx: Ctx) => {
  const user = await requireUser();
  const { slug } = await deleteMyReview(String(user._id), (await ctx.params).slug);
  invalidateProducts(slug);
  return ok({ deleted: true });
});
