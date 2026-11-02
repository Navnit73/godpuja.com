import { ApiError, handle, ok, readJson } from "@/server/api";
import { hashPassword } from "@/server/auth/password";
import { setSessionCookie } from "@/server/auth/session";
import { connectDB } from "@/server/db";
import { User } from "@/server/models/User";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { registerSchema } from "@/lib/validation/auth";

export const POST = handle(async (req) => {
  // No public sign-up UI exists until the storefront account feature (Stage 8/9). Closed by default.
  if (process.env.ALLOW_PUBLIC_REGISTRATION !== "true") throw new ApiError("FORBIDDEN", "Registration is not open");
  rateLimit(`register:${clientIp(req)}`, 5, 60_000);
  const { name, email, password } = registerSchema.parse(await readJson(req));

  await connectDB();
  try {
    // role is never read from the request body: public signup is always a customer.
    const user = await User.create({ name, email, passwordHash: await hashPassword(password), role: "customer" });
    await setSessionCookie({ uid: String(user._id), role: "customer", tv: 0 });
    return ok({ id: String(user._id), name, email, role: "customer" }, { status: 201 });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw new ApiError("CONFLICT", "An account with this email already exists", { email: "Already registered" });
    }
    throw err;
  }
});
