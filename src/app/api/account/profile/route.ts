import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { getProfile, updateProfile } from "@/server/services/account";
import { profileSchema } from "@/lib/validation/account";

export const GET = handle(async () => ok(await getProfile(String((await requireUser())._id))));

export const PATCH = handle(async (req) => {
  const user = await requireUser();
  return ok(await updateProfile(String(user._id), profileSchema.parse(await readJson(req))));
});
