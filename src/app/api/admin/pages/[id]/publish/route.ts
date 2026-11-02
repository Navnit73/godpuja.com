import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { invalidatePages } from "@/server/public/pages";
import { setPublishState } from "@/server/services/pages";
import { publishSchema } from "@/lib/validation/pages";

export const POST = handle(async (req, ctx: RouteContext<"/api/admin/pages/[id]/publish">) => {
  await requireUser("pages:publish");
  const page = await setPublishState((await ctx.params).id, publishSchema.parse(await readJson(req)));
  invalidatePages(page.slug);
  return ok(page);
});
