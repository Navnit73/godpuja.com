import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { invalidateHomepage } from "@/server/public/homepage";
import { getHomepage, updateHomepage } from "@/server/services/homepage";
import { updateHomepageSchema } from "@/lib/validation/homepage";

export const GET = handle(async () => {
  await requireUser("home:write");
  return ok(await getHomepage());
});

export const PUT = handle(async (req) => {
  await requireUser("home:write");
  const home = await updateHomepage(updateHomepageSchema.parse(await readJson(req)));
  invalidateHomepage();
  return ok(home);
});
