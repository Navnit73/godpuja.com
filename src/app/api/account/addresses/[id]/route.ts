import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { removeAddress, updateAddress } from "@/server/services/account";
import { savedAddressSchema } from "@/lib/validation/account";

type Ctx = RouteContext<"/api/account/addresses/[id]">;

export const PATCH = handle(async (req, ctx: Ctx) => {
  const user = await requireUser();
  return ok(await updateAddress(String(user._id), (await ctx.params).id, savedAddressSchema.parse(await readJson(req))));
});

export const DELETE = handle(async (_req, ctx: Ctx) => {
  const user = await requireUser();
  return ok(await removeAddress(String(user._id), (await ctx.params).id));
});
