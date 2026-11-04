import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { createVidhi, listVidhi } from "@/server/services/vidhi";
import { listVidhiSchema, vidhiInputSchema } from "@/lib/validation/vidhi";

export const GET = handle(async (req) => {
  await requireUser("vidhi:read");
  const { items, ...meta } = await listVidhi(listVidhiSchema.parse(Object.fromEntries(new URL(req.url).searchParams)));
  return ok(items, { meta });
});

export const POST = handle(async (req) => {
  await requireUser("vidhi:write");
  return ok(await createVidhi(vidhiInputSchema.parse(await readJson(req))), { status: 201 });
});
