import { handle, ok } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { rotateDevotionalPreviewToken } from "@/server/services/devotional";

export const POST = handle(async (_req, ctx: RouteContext<"/api/admin/aarti-mantras/[id]/preview-token">) => {
  await requireUser("devotional:write");
  return ok(await rotateDevotionalPreviewToken((await ctx.params).id));
});
