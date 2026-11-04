import { handle, ok } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { removeFromWishlist } from "@/server/services/wishlist";

export const DELETE = handle(async (_req, ctx: RouteContext<"/api/account/wishlist/[productId]">) => {
  const user = await requireUser();
  return ok(await removeFromWishlist(String(user._id), (await ctx.params).productId));
});
