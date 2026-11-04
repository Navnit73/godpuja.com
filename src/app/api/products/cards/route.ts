import { z } from "zod";
import { handle, ok, readJson } from "@/server/api";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { findCards } from "@/server/services/products";

// Public. Cards for a few product slugs the browser remembers ("recently viewed"). Unknown or hidden ones are dropped.
export const POST = handle(async (req) => {
  rateLimit(`cards:${clientIp(req)}`, 60, 60_000);
  const { slugs } = z.object({ slugs: z.array(z.string().max(100)).max(12) }).parse(await readJson(req));
  return ok(await findCards({ slugs }));
});
