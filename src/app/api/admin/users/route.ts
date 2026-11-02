import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { createUser, listUsers } from "@/server/services/users";
import { createUserSchema, listUsersSchema } from "@/lib/validation/users";

export const GET = handle(async (req) => {
  await requireUser("users:read");
  const params = listUsersSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { items, ...meta } = await listUsers(params);
  return ok(items, { meta });
});

export const POST = handle(async (req) => {
  await requireUser("users:write");
  const user = await createUser(createUserSchema.parse(await readJson(req)));
  return ok(user, { status: 201 });
});
