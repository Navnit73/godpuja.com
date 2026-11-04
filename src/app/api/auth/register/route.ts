import { ApiError, handle, ok, readJson } from "@/server/api";
import { setSessionCookie } from "@/server/auth/session";
import { env } from "@/server/env";
import { clientIp, rateLimitShared } from "@/server/rate-limit";
import { registerCustomer } from "@/server/services/account";
import { registerSchema } from "@/lib/validation/auth";

// Customer sign-up (Stage 13). Sends a verification email; the account works at once, and past guest orders are
// attached only after the email is verified.
export const POST = handle(async (req) => {
  if (env().ALLOW_PUBLIC_REGISTRATION !== "true") throw new ApiError("FORBIDDEN", "Registration is not open");
  await rateLimitShared(`register:${clientIp(req)}`, 5, 60_000);
  const input = registerSchema.parse(await readJson(req));
  const user = await registerCustomer(input);
  await setSessionCookie({ uid: user.id, role: "customer", tv: 0 });
  return ok(user, { status: 201 });
});
