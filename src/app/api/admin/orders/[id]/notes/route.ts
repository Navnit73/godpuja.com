import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { addNote } from "@/server/services/orders";
import { noteSchema } from "@/lib/validation/orders";

export const POST = handle(async (req, ctx: RouteContext<"/api/admin/orders/[id]/notes">) => {
  const user = await requireUser("orders:write");
  const { text } = noteSchema.parse(await readJson(req));
  return ok(await addNote((await ctx.params).id, text, { id: String(user._id), name: user.name }), { status: 201 });
});
