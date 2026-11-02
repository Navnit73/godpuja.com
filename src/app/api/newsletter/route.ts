import { handle, ok, readJson } from "@/server/api";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { subscribe } from "@/server/services/footer";
import { subscribeSchema } from "@/lib/validation/footer";

export const POST = handle(async (req) => {
  rateLimit(`newsletter:${clientIp(req)}`, 5, 60_000);
  const { email, _hp } = subscribeSchema.parse(await readJson(req));
  // Bots that fill the hidden field get the same success response but nothing is stored.
  if (!_hp) await subscribe(email);
  return ok({ subscribed: true });
});
