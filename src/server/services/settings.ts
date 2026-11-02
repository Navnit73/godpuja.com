import { ApiError } from "../api";
import { connectDB } from "../db";
import { Settings, type SettingsDoc } from "../models/Settings";
import { defaultSeoSettings, type SeoSettings, type UpdateSeoSettings } from "@/lib/validation/seo";

export type AdminSeoSettings = SeoSettings & { updatedAt: string | null };

const pick = (d: SettingsDoc): SeoSettings => ({
  siteName: d.siteName || defaultSeoSettings.siteName, defaultTitle: d.defaultTitle ?? "", defaultDescription: d.defaultDescription ?? "",
  defaultOgImage: d.defaultOgImage ?? "", twitterHandle: d.twitterHandle ?? "", logoUrl: d.logoUrl ?? "", homeTitle: d.homeTitle ?? "", homeDescription: d.homeDescription ?? "",
});

export async function getSeoSettings(): Promise<AdminSeoSettings> {
  await connectDB();
  const d = await Settings.findOne({ key: "main" }).lean();
  return d ? { ...pick(d), updatedAt: d.updatedAt.toISOString() } : { ...defaultSeoSettings, updatedAt: null };
}

/** First save is create-only; later saves need the version the editor loaded (stale => 409). */
export async function updateSeoSettings({ baseUpdatedAt, ...input }: UpdateSeoSettings): Promise<AdminSeoSettings> {
  await connectDB();
  const stale = new ApiError("CONFLICT", "These settings were changed by someone else. Reload to see their changes before saving.");
  let d: SettingsDoc | null;
  if (baseUpdatedAt === null) {
    try { d = (await Settings.create({ key: "main", ...input })).toObject() as SettingsDoc; }
    catch (err) { if ((err as { code?: number }).code === 11000) throw stale; throw err; }
  } else {
    d = await Settings.findOneAndUpdate({ key: "main", updatedAt: new Date(baseUpdatedAt) }, { $set: input }, { returnDocument: "after" }).lean();
    if (!d) throw stale;
  }
  return { ...pick(d), updatedAt: d.updatedAt.toISOString() };
}

/** Effective public settings (stored values with defaults filled in). */
export async function findSiteSettings(): Promise<SeoSettings> {
  const s = await getSeoSettings();
  return {
    ...s,
    defaultTitle: s.defaultTitle || `${s.siteName}`,
    defaultDescription: s.defaultDescription || defaultSeoSettings.defaultDescription,
  };
}
