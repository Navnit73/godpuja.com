import { handle, ok } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { deleteRedirect } from "@/server/services/redirects";

type Ctx = RouteContext<"/api/admin/redirects/[id]">;

export const DELETE = handle(async (_req, ctx: Ctx) => {
  await requireUser("seo:write");
  await deleteRedirect((await ctx.params).id);
  return ok({ deleted: true });
});
