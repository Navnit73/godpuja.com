import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { invalidateProducts } from "@/server/public/catalog";
import { audit } from "@/server/services/audit";
import { deleteReview, moderateReview } from "@/server/services/reviews";
import { moderateSchema } from "@/lib/validation/reviews";

type Ctx = RouteContext<"/api/admin/reviews/[id]">;

export const PATCH = handle(async (req, ctx: Ctx) => {
  const user = await requireUser("reviews:write");
  const id = (await ctx.params).id;
  const { status, note } = moderateSchema.parse(await readJson(req));
  const r = await moderateReview(id, status, note, user.name);
  invalidateProducts(r.slug);
  await audit(user, `review.${status}`, { type: "review", id });
  return ok(r);
});

export const DELETE = handle(async (_req, ctx: Ctx) => {
  const user = await requireUser("reviews:write");
  const id = (await ctx.params).id;
  const { slug } = await deleteReview(id);
  invalidateProducts(slug);
  await audit(user, "review.delete", { type: "review", id });
  return ok({ deleted: true });
});
