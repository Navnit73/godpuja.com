import { handle, ok, readJson } from "@/server/api";
import { clientIp, rateLimitShared } from "@/server/rate-limit";
import { verifyEmail } from "@/server/services/account";
import { tokenSchema } from "@/lib/validation/account";

// POST (not GET) so link scanners that prefetch email links cannot use up the single-use token.
export const POST = handle(async (req) => {
  await rateLimitShared(`verify:${clientIp(req)}`, 20, 15 * 60_000);
  const { token } = tokenSchema.parse(await readJson(req));
  const { claimed } = await verifyEmail(token);
  return ok({ verified: true, claimedOrders: claimed });
});
