import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { clientIp } from "@/server/rate-limit";
import { audit } from "@/server/services/audit";
import { createUser, listUsers } from "@/server/services/users";
import { createUserSchema, listUsersSchema } from "@/lib/validation/users";

export const GET = handle(async (req) => {
  await requireUser("users:read");
  const params = listUsersSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { items, ...meta } = await listUsers(params);
  return ok(items, { meta });
});

export const POST = handle(async (req) => {
  const actor = await requireUser("users:write");
  const user = await createUser(createUserSchema.parse(await readJson(req)));
  await audit(actor, "user.create", { type: "user", id: user.id }, ["name", "email", "role"], clientIp(req));
  return ok(user, { status: 201 });
});
