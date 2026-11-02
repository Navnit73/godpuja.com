import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { deleteMedia, updateMediaAlt } from "@/server/services/media";
import { mediaAltSchema } from "@/lib/validation/catalog";

type Ctx = RouteContext<"/api/admin/media/[id]">;

export const PATCH = handle(async (req, ctx: Ctx) => {
  await requireUser("media:write");
  return ok(await updateMediaAlt((await ctx.params).id, mediaAltSchema.parse(await readJson(req)).alt));
});

export const DELETE = handle(async (_req, ctx: Ctx) => {
  await requireUser("media:write");
  await deleteMedia((await ctx.params).id);
  return ok({ deleted: true });
});
