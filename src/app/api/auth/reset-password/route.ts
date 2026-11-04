import { handle, ok, readJson } from "@/server/api";
import { setSessionCookie } from "@/server/auth/session";
import { clientIp, rateLimitShared } from "@/server/rate-limit";
import { resetPassword } from "@/server/services/account";
import { resetPasswordSchema } from "@/lib/validation/account";

// Sets the new password, signs out every other session, and signs this browser in.
export const POST = handle(async (req) => {
  await rateLimitShared(`reset:${clientIp(req)}`, 10, 15 * 60_000);
  const { token, password } = resetPasswordSchema.parse(await readJson(req));
  const claims = await resetPassword(token, password);
  await setSessionCookie(claims);
  return ok({ reset: true, role: claims.role });
});
