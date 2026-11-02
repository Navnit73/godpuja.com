import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { invalidateProducts } from "@/server/public/catalog";
import { adjustStock, getProduct } from "@/server/services/products";
import { inventorySchema } from "@/lib/validation/catalog";

type Ctx = RouteContext<"/api/admin/inventory/[id]">;

export const PATCH = handle(async (req, ctx: Ctx) => {
  await requireUser("inventory:write");
  const id = (await ctx.params).id;
  const result = await adjustStock(id, inventorySchema.parse(await readJson(req)));
  invalidateProducts((await getProduct(id)).slug); // in-stock badge on the storefront
  return ok(result);
});
