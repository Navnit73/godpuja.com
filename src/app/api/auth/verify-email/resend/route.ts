import { handle, ok } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { rateLimitShared } from "@/server/rate-limit";
import { sendVerification } from "@/server/services/account";

export const POST = handle(async () => {
  const user = await requireUser();
  await rateLimitShared(`verify-resend:${String(user._id)}`, 3, 60 * 60_000);
  const state = await sendVerification(String(user._id));
  return ok({ state });
});
