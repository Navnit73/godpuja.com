import { handle, ok } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { rotatePreviewToken } from "@/server/services/pages";

export const POST = handle(async (_req, ctx: RouteContext<"/api/admin/pages/[id]/preview-token">) => {
  await requireUser("pages:write");
  return ok(await rotatePreviewToken((await ctx.params).id));
});
