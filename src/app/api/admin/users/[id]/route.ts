import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { clientIp } from "@/server/rate-limit";
import { audit } from "@/server/services/audit";
import { setSessionCookie } from "@/server/auth/session";
import { getSessionClaims, getUser, updateUser } from "@/server/services/users";
import { updateUserSchema } from "@/lib/validation/users";

export const GET = handle(async (_req, ctx: RouteContext<"/api/admin/users/[id]">) => {
  await requireUser("users:read");
  return ok(await getUser((await ctx.params).id));
});

export const PATCH = handle(async (req, ctx: RouteContext<"/api/admin/users/[id]">) => {
  const actor = await requireUser("users:write");
  const input = updateUserSchema.parse(await readJson(req));
  const id = (await ctx.params).id;
  const updated = await updateUser(String(actor._id), id, input);
  await audit(actor, "user.update", { type: "user", id }, Object.keys(input).filter((k) => input[k as keyof typeof input] !== undefined), clientIp(req));
  // Changing your own password bumps tokenVersion; re-issue the cookie so you are not signed out.
  if (input.password !== undefined && id === String(actor._id)) await setSessionCookie(await getSessionClaims(id));
  return ok(updated);
});
