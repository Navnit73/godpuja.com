import { handle, ok } from "@/server/api";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { suggestAll } from "@/server/services/search";

// Type-ahead for the header search: public, uncached (the input space is unbounded), bounded and rate limited.
export const GET = handle(async (req) => {
  rateLimit(`suggest:${clientIp(req)}`, 90, 60_000);
  return ok(await suggestAll(new URL(req.url).searchParams.get("q") ?? ""));
});
