import { handle, ok } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { listOrders } from "@/server/services/orders";
import { listOrdersSchema } from "@/lib/validation/orders";

export const GET = handle(async (req) => {
  await requireUser("orders:read");
  const { items, ...meta } = await listOrders(listOrdersSchema.parse(Object.fromEntries(new URL(req.url).searchParams)));
  return ok(items, { meta });
});
