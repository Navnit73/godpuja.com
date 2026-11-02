import { handle, ok } from "@/server/api";
import { clearSessionCookie } from "@/server/auth/session";

export const POST = handle(async () => {
  await clearSessionCookie();
  return ok({ loggedOut: true });
});
