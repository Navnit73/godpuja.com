import { ApiError, handle, ok, readJson } from "@/server/api";
import { setSessionCookie } from "@/server/auth/session";
import { verifyPassword } from "@/server/auth/password";
import { connectDB } from "@/server/db";
import { User } from "@/server/models/User";
import { clientIp, rateLimitShared, rateLimitSharedPeek } from "@/server/rate-limit";
import { loginSchema } from "@/lib/validation/auth";

export const POST = handle(async (req) => {
  const { email, password } = loginSchema.parse(await readJson(req));
  // Shared store: these limits hold across all server instances.
  const ip = clientIp(req);
  await rateLimitShared(`login:${ip}:${email}`, 5, 60_000);
  await rateLimitShared(`login-ip:${ip}`, 30, 60_000);
  // IP-independent cap per account, counting FAILURES only so a successful login never contributes to a lockout.
  const FAIL_KEY = `login-fail:${email}`;
  const FAIL_WINDOW = 15 * 60_000;
  await rateLimitSharedPeek(FAIL_KEY, 20, FAIL_WINDOW);

  await connectDB();
  const user = await User.findOne({ email }).select("+passwordHash name email role isActive tokenVersion");
  const valid = await verifyPassword(password, user?.passwordHash);
  if (!user || !valid || !user.isActive) {
    await rateLimitShared(FAIL_KEY, 20, FAIL_WINDOW);
    throw new ApiError("UNAUTHENTICATED", "Invalid email or password");
  }

  await User.updateOne({ _id: user._id }, { lastLoginAt: new Date() });
  await setSessionCookie({ uid: String(user._id), role: user.role, tv: user.tokenVersion ?? 0 });
  return ok({ id: String(user._id), name: user.name, email: user.email, role: user.role });
});
