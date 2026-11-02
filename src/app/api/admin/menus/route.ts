import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { invalidateMenus } from "@/server/public/menus";
import { createMenu, listMenus } from "@/server/services/menus";
import { createMenuSchema } from "@/lib/validation/menus";

export const GET = handle(async () => {
  await requireUser("nav:write");
  return ok(await listMenus());
});

export const POST = handle(async (req) => {
  await requireUser("nav:write");
  const menu = await createMenu(createMenuSchema.parse(await readJson(req)));
  invalidateMenus(menu.key);
  return ok(menu, { status: 201 });
});
