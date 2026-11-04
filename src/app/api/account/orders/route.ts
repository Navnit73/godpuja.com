import { z } from "zod";
import { handle, ok } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { listMyOrders } from "@/server/services/account";

const query = z.object({ page: z.coerce.number().int().min(1).max(1000).default(1) });

export const GET = handle(async (req) => {
  const user = await requireUser();
  const { page } = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  const r = await listMyOrders(String(user._id), page);
  return ok(r.items, { meta: { total: r.total, page: r.page, limit: r.limit, pages: r.pages } });
});
