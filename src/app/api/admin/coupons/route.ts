import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { audit } from "@/server/services/audit";
import { createCoupon, listCoupons } from "@/server/services/coupons";
import { couponSchema } from "@/lib/validation/coupons";

export const GET = handle(async () => {
  await requireUser("coupons:write");
  return ok(await listCoupons());
});

export const POST = handle(async (req) => {
  const user = await requireUser("coupons:write");
  const created = await createCoupon(couponSchema.parse(await readJson(req)));
  await audit(user, "coupon.create", { type: "coupon", id: created.id }, ["code", "type", "value"]);
  return ok(created, { status: 201 });
});
