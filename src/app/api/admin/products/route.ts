import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { invalidateProducts } from "@/server/public/catalog";
import { createProduct, listProducts } from "@/server/services/products";
import { listProductsSchema, productInputSchema } from "@/lib/validation/catalog";

export const GET = handle(async (req) => {
  await requireUser("products:read");
  const { items, ...meta } = await listProducts(listProductsSchema.parse(Object.fromEntries(new URL(req.url).searchParams)));
  return ok(items, { meta });
});

export const POST = handle(async (req) => {
  await requireUser("products:write");
  const p = await createProduct(productInputSchema.parse(await readJson(req)));
  invalidateProducts(p.slug);
  return ok(p, { status: 201 });
});
