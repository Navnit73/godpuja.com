import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { createDevotional, listDevotionals } from "@/server/services/devotional";
import { devotionalInputSchema, listDevotionalSchema } from "@/lib/validation/devotional";

export const GET = handle(async (req) => {
  await requireUser("devotional:read");
  const { items, ...meta } = await listDevotionals(listDevotionalSchema.parse(Object.fromEntries(new URL(req.url).searchParams)));
  return ok(items, { meta });
});

export const POST = handle(async (req) => {
  await requireUser("devotional:write");
  return ok(await createDevotional(devotionalInputSchema.parse(await readJson(req))), { status: 201 });
});
