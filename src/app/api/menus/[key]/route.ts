import { ApiError, handle, ok } from "@/server/api";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { getPublicMenu } from "@/server/public/menus";
import { menuKeySchema } from "@/lib/validation/menus";

type Ctx = RouteContext<"/api/menus/[key]">;

export const GET = handle(async (req, ctx: Ctx) => {
  rateLimit(`menus:${clientIp(req)}`, 120, 60_000); // each distinct key costs a cache entry + DB read
  const key = menuKeySchema.safeParse((await ctx.params).key);
  if (!key.success) throw new ApiError("NOT_FOUND", "Menu not found");
  const menu = await getPublicMenu(key.data);
  if (!menu) throw new ApiError("NOT_FOUND", "Menu not found");
  return ok(menu);
});
