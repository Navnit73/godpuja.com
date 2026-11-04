import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { audit } from "@/server/services/audit";
import { deleteCoupon, getCoupon, updateCoupon } from "@/server/services/coupons";
import { updateCouponSchema } from "@/lib/validation/coupons";

type Ctx = RouteContext<"/api/admin/coupons/[id]">;

export const GET = handle(async (_req, ctx: Ctx) => {
  await requireUser("coupons:write");
  return ok(await getCoupon((await ctx.params).id));
});

export const PATCH = handle(async (req, ctx: Ctx) => {
  const user = await requireUser("coupons:write");
  const id = (await ctx.params).id;
  const updated = await updateCoupon(id, updateCouponSchema.parse(await readJson(req)));
  await audit(user, "coupon.update", { type: "coupon", id }, ["terms"]);
  return ok(updated);
});

export const DELETE = handle(async (_req, ctx: Ctx) => {
  const user = await requireUser("coupons:write");
  const id = (await ctx.params).id;
  await deleteCoupon(id);
  await audit(user, "coupon.delete", { type: "coupon", id });
  return ok({ deleted: true });
});
