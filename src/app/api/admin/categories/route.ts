import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { invalidateCategories } from "@/server/public/catalog";
import { createCategory, listCategories } from "@/server/services/categories";
import { categoryInputSchema } from "@/lib/validation/catalog";

export const GET = handle(async () => {
  await requireUser("categories:write");
  return ok(await listCategories());
});

export const POST = handle(async (req) => {
  await requireUser("categories:write");
  const c = await createCategory(categoryInputSchema.parse(await readJson(req)));
  invalidateCategories();
  return ok(c, { status: 201 });
});
