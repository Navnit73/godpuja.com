import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { invalidateFooter } from "@/server/public/footer";
import { getFooter, updateFooter } from "@/server/services/footer";
import { updateFooterSchema } from "@/lib/validation/footer";

export const GET = handle(async () => {
  await requireUser("footer:write");
  return ok(await getFooter());
});

export const PUT = handle(async (req) => {
  await requireUser("footer:write");
  const footer = await updateFooter(updateFooterSchema.parse(await readJson(req)));
  invalidateFooter();
  return ok(footer);
});
