import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { invalidateMenus } from "@/server/public/menus";
import { getMenu, updateMenu } from "@/server/services/menus";
import { updateMenuSchema } from "@/lib/validation/menus";

type Ctx = RouteContext<"/api/admin/menus/[id]">;

export const GET = handle(async (_req, ctx: Ctx) => {
  await requireUser("nav:write");
  return ok(await getMenu((await ctx.params).id));
});

export const PUT = handle(async (req, ctx: Ctx) => {
  await requireUser("nav:write");
  const menu = await updateMenu((await ctx.params).id, updateMenuSchema.parse(await readJson(req)));
  invalidateMenus(menu.key);
  return ok(menu);
});
