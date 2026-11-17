import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { invalidateDevotional } from "@/server/public/devotional";
import { invalidateVidhi } from "@/server/public/vidhi";
import { setDevotionalPublishState } from "@/server/services/devotional";
import { devotionalPublishSchema } from "@/lib/validation/devotional";

export const POST = handle(async (req, ctx: RouteContext<"/api/admin/aarti-mantras/[id]/publish">) => {
  await requireUser("devotional:publish");
  const v = await setDevotionalPublishState((await ctx.params).id, devotionalPublishSchema.parse(await readJson(req)));
  invalidateDevotional(v.slug);
  invalidateVidhi();
  return ok(v);
});
