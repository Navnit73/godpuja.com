import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { createRedirect, listRedirects } from "@/server/services/redirects";
import { listRedirectsSchema, redirectInputSchema } from "@/lib/validation/seo";

export const GET = handle(async (req) => {
  await requireUser("seo:write");
  const { items, ...meta } = await listRedirects(listRedirectsSchema.parse(Object.fromEntries(new URL(req.url).searchParams)));
  return ok(items, { meta });
});

// Takes effect within ~60 s on each server instance (the proxy caches the table).
export const POST = handle(async (req) => {
  await requireUser("seo:write");
  return ok(await createRedirect(redirectInputSchema.parse(await readJson(req))), { status: 201 });
});
