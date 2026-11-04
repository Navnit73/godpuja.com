import { env } from "../env";

export type OutgoingEmail = { to: string; subject: string; html: string; text: string };
export type SendResult = { state: "sent"; provider: string; providerId: string } | { state: "skipped"; reason: string } | { state: "failed"; provider: string; error: string };

/**
 * Transactional email through Resend's HTTP API (no SDK). Without RESEND_API_KEY + EMAIL_FROM nothing is sent: the
 * notification is logged as "skipped" and, outside tests, the text body is printed so links work in development.
 */
export async function sendEmail(msg: OutgoingEmail, cfg: { RESEND_API_KEY?: string; EMAIL_FROM?: string } = env()): Promise<SendResult> {
  const { RESEND_API_KEY: key, EMAIL_FROM: from } = cfg;
  if (!key || !from) {
    if (process.env.NODE_ENV !== "test") console.info(`[email:not-configured] to=${msg.to} subject="${msg.subject}"\n${msg.text}`);
    return { state: "skipped", reason: "Email provider not configured" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!res.ok || !body?.id) return { state: "failed", provider: "resend", error: `${res.status} ${body?.message ?? ""}`.trim().slice(0, 300) };
    return { state: "sent", provider: "resend", providerId: body.id };
  } catch (e) {
    return { state: "failed", provider: "resend", error: (e as Error).message.slice(0, 300) };
  }
}
