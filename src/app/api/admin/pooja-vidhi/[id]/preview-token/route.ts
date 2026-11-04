import { handle, ok } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { rotateVidhiPreviewToken } from "@/server/services/vidhi";

export const POST = handle(async (_req, ctx: RouteContext<"/api/admin/pooja-vidhi/[id]/preview-token">) => {
  await requireUser("vidhi:write");
  return ok(await rotateVidhiPreviewToken((await ctx.params).id));
});
