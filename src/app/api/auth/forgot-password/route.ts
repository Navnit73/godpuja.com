import { handle, ok, readJson } from "@/server/api";
import { clientIp, rateLimitShared } from "@/server/rate-limit";
import { requestPasswordReset } from "@/server/services/account";
import { forgotPasswordSchema } from "@/lib/validation/account";

// Same answer whether or not the email has an account (no enumeration). The email is sent after the response.
export const POST = handle(async (req) => {
  await rateLimitShared(`forgot:${clientIp(req)}`, 5, 15 * 60_000);
  const { email } = forgotPasswordSchema.parse(await readJson(req));
  await rateLimitShared(`forgot-email:${email}`, 3, 60 * 60_000);
  await requestPasswordReset(email);
  return ok({ sent: true });
});
