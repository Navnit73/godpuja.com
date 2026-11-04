import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { setSessionCookie } from "@/server/auth/session";
import { rateLimitShared } from "@/server/rate-limit";
import { changePassword } from "@/server/services/account";
import { changePasswordSchema } from "@/lib/validation/account";

// Changing the password signs out every other session; this browser gets a fresh cookie.
export const POST = handle(async (req) => {
  const user = await requireUser();
  await rateLimitShared(`password:${String(user._id)}`, 5, 15 * 60_000);
  const { currentPassword, newPassword } = changePasswordSchema.parse(await readJson(req));
  await setSessionCookie(await changePassword(String(user._id), currentPassword, newPassword));
  return ok({ changed: true });
});
