import { handle, ok } from "@/server/api";
import { requireUser } from "@/server/auth/guard";

export const GET = handle(async () => {
  const u = await requireUser();
  return ok({ id: String(u._id), name: u.name, email: u.email, role: u.role });
});
