import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { createPage, listPages } from "@/server/services/pages";
import { listPagesSchema, pageInputSchema } from "@/lib/validation/pages";

export const GET = handle(async (req) => {
  await requireUser("pages:read");
  const { items, ...meta } = await listPages(listPagesSchema.parse(Object.fromEntries(new URL(req.url).searchParams)));
  return ok(items, { meta });
});

export const POST = handle(async (req) => {
  await requireUser("pages:write");
  return ok(await createPage(pageInputSchema.parse(await readJson(req))), { status: 201 });
});
