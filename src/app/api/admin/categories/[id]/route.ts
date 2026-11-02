import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { invalidateCategories } from "@/server/public/catalog";
import { deleteCategory, getCategory, updateCategory } from "@/server/services/categories";
import { updateCategorySchema } from "@/lib/validation/catalog";

type Ctx = RouteContext<"/api/admin/categories/[id]">;

export const GET = handle(async (_req, ctx: Ctx) => {
  await requireUser("categories:write");
  return ok(await getCategory((await ctx.params).id));
});

export const PATCH = handle(async (req, ctx: Ctx) => {
  await requireUser("categories:write");
  const c = await updateCategory((await ctx.params).id, updateCategorySchema.parse(await readJson(req)));
  invalidateCategories();
  return ok(c);
});

export const DELETE = handle(async (_req, ctx: Ctx) => {
  await requireUser("categories:write");
  await deleteCategory((await ctx.params).id);
  invalidateCategories();
  return ok({ deleted: true });
});
