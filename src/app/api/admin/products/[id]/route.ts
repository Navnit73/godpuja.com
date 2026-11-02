import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { invalidateProducts } from "@/server/public/catalog";
import { deleteProduct, getProduct, updateProduct } from "@/server/services/products";
import { updateProductSchema } from "@/lib/validation/catalog";

type Ctx = RouteContext<"/api/admin/products/[id]">;

export const GET = handle(async (_req, ctx: Ctx) => {
  await requireUser("products:read");
  return ok(await getProduct((await ctx.params).id));
});

export const PATCH = handle(async (req, ctx: Ctx) => {
  await requireUser("products:write");
  const { product, previousSlug } = await updateProduct((await ctx.params).id, updateProductSchema.parse(await readJson(req)));
  invalidateProducts(product.slug, previousSlug);
  return ok(product);
});

export const DELETE = handle(async (_req, ctx: Ctx) => {
  await requireUser("products:write");
  const { slug } = await deleteProduct((await ctx.params).id);
  invalidateProducts(slug);
  return ok({ deleted: true });
});
