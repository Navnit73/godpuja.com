import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { invalidateSettings } from "@/server/public/settings";
import { getSeoSettings, updateSeoSettings } from "@/server/services/settings";
import { updateSeoSettingsSchema } from "@/lib/validation/seo";

export const GET = handle(async () => {
  await requireUser("seo:write");
  return ok(await getSeoSettings());
});

export const PUT = handle(async (req) => {
  await requireUser("seo:write");
  const s = await updateSeoSettings(updateSeoSettingsSchema.parse(await readJson(req)));
  invalidateSettings();
  return ok(s);
});
