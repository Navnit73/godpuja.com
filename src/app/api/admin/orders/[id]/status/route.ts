import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { invalidateProducts } from "@/server/public/catalog";
import { changeStatus } from "@/server/services/orders";
import { statusChangeSchema } from "@/lib/validation/orders";

export const PATCH = handle(async (req, ctx: RouteContext<"/api/admin/orders/[id]/status">) => {
  const user = await requireUser("orders:write");
  const { status, note } = statusChangeSchema.parse(await readJson(req));
  const order = await changeStatus((await ctx.params).id, status, note, { id: String(user._id), name: user.name });
  // Cancelling puts the units back in stock: refresh the storefront's in-stock badges for those products.
  if (status === "cancelled") invalidateProducts(...order.items.map((i) => i.slug));
  return ok(order);
});
