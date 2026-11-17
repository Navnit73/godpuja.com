/**
 * Seeds the TEST database (godpuja_test) with the Phase 1 content the E2E run (scripts/e2e-phase1.mjs) looks for.
 * Refuses to touch any other database. Usage: npx tsx scripts/e2e-seed.ts
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const u = new URL(process.env.MONGODB_URI ?? "");
u.pathname = "/godpuja_test";
process.env.MONGODB_URI = u.toString();

import mongoose from "mongoose";
import { connectDB } from "../src/server/db";
import { Devotional } from "../src/server/models/Devotional";
import { Homepage } from "../src/server/models/Homepage";
import { Settings } from "../src/server/models/Settings";
import { Vidhi } from "../src/server/models/Vidhi";
import { createDevotional, setDevotionalPublishState } from "../src/server/services/devotional";
import { updateHomepage } from "../src/server/services/homepage";
import { updateSeoSettings } from "../src/server/services/settings";
import { createVidhi, setVidhiPublishState } from "../src/server/services/vidhi";
import { defaultData, type HomeSection, type SectionType } from "../src/lib/validation/homepage";
import { devotionalInputSchema, emptyDevotional } from "../src/lib/validation/devotional";
import { defaultSeoSettings } from "../src/lib/validation/seo";
import { emptyVidhi, vidhiInputSchema } from "../src/lib/validation/vidhi";

const sec = <T extends SectionType>(type: T, id: string, data: Record<string, unknown> = {}) => ({ id, type, enabled: true, data: { ...structuredClone(defaultData[type]), ...data } }) as unknown as HomeSection;
const REVIEWED = { reviewer: "Pt. Sharma", reviewedAt: "2026-11-01T00:00:00+05:30" };

async function main() {
  await connectDB();
  if (mongoose.connection.name !== "godpuja_test") throw new Error(`Refusing to seed ${mongoose.connection.name}`);
  await Promise.all([Devotional, Homepage, Settings, Vidhi].map((m) => (m as typeof Vidhi).deleteMany({})));
  await updateSeoSettings({ ...defaultSeoSettings, gaMeasurementId: "G-E2ETEST123", baseUpdatedAt: null });
  const mk = async (over: object) => setDevotionalPublishState((await createDevotional(devotionalInputSchema.parse({ ...emptyDevotional, ...REVIEWED, ...over }))).id, { action: "publish" });
  const rights = { source: "Recorded for GodPuja", licence: "original", reference: "", expiresAt: "", withdrawn: false };
  await mk({ title: "Ganesh Aarti", slug: "ganesh-aarti", type: "aarti", deity: "Ganesha", language: "hindi", lyrics: "जय गणेश जय गणेश देवा\nमाता जाकी पार्वती", audioUrl: "https://example.com/ganesh.mp3", rights });
  await mk({ title: "Lakshmi Aarti", slug: "lakshmi-aarti", type: "aarti", deity: "Lakshmi", language: "hindi", lyrics: "ॐ जय लक्ष्मी माता", audioUrl: "https://example.com/lakshmi.mp3", rights: { ...rights, withdrawn: true } });
  await mk({ title: "Gayatri Mantra", slug: "gayatri-mantra", type: "mantra", deity: "Gayatri", language: "sanskrit", lyrics: "ॐ भूर्भुवः स्वः" });
  await setVidhiPublishState((await createVidhi(vidhiInputSchema.parse({ ...emptyVidhi, title: "Daily Ganesh Pooja", slug: "daily-ganesh-pooja", summary: "A short daily pooja.", steps: [{ title: "", body: "Light the diya." }], relatedAarti: ["ganesh-aarti"], ...REVIEWED }))).id, { action: "publish" });
  await updateHomepage({ baseUpdatedAt: null, sections: [sec("pillars", "p1"), sec("vidhiHighlights", "v1"), sec("devotionalHighlights", "d1", { kind: "aarti" })] });
  console.log("seeded godpuja_test");
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
