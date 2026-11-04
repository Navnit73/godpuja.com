import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { invalidateVidhi } from "@/server/public/vidhi";
import { setVidhiPublishState } from "@/server/services/vidhi";
import { vidhiPublishSchema } from "@/lib/validation/vidhi";

export const POST = handle(async (req, ctx: RouteContext<"/api/admin/pooja-vidhi/[id]/publish">) => {
  await requireUser("vidhi:publish");
  const v = await setVidhiPublishState((await ctx.params).id, vidhiPublishSchema.parse(await readJson(req)));
  invalidateVidhi(v.slug);
  return ok(v);
});
