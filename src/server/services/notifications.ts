import { after } from "next/server";
import { connectDB } from "../db";
import { sendEmail, type OutgoingEmail } from "../email/send";
import { Notification } from "../models/Notification";
import { findSiteSettings } from "./settings";

/** Send one email and record its delivery state (PRD v1.1 §15 Notifications). Never throws for delivery problems. */
export async function deliver(email: OutgoingEmail, template: string, ref: { kind: string; id: string } | null = null) {
  await connectDB();
  const row = await Notification.create({ to: email.to, template, subject: email.subject, ref });
  const r = await sendEmail(email);
  const set = r.state === "sent" ? { state: "sent", provider: r.provider, providerId: r.providerId }
    : r.state === "skipped" ? { state: "skipped", error: r.reason } : { state: "failed", provider: r.provider, error: r.error };
  await Notification.updateOne({ _id: row._id }, { $set: set });
  return r.state;
}

export const siteName = async () => (await findSiteSettings()).siteName || "GodPuja";

const background = new Set<Promise<unknown>>();
/**
 * Run a notification after the response is sent (`after`), so email latency never slows checkout or admin actions and
 * a failed email never fails the action. Outside a request (scripts, tests) it runs in the background instead.
 */
export function defer(task: () => Promise<unknown>) {
  const run = () => task().catch((e) => console.error("[notify] failed", e));
  try {
    after(run);
  } catch {
    const p = run().finally(() => background.delete(p));
    background.add(p);
  }
}
/** Wait for background notifications (tests / scripts, before disconnecting). */
export const flushNotifications = async () => { while (background.size) await Promise.all([...background]); };
