"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";

/** Shown until the email is verified. Verifying also links earlier guest orders placed with this email. */
export default function VerifyBanner({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");
  async function resend() {
    setState("busy");
    try {
      const r = await api.post<{ state: string }>("/auth/verify-email/resend");
      setState("sent");
      setMsg(r.state === "already_verified" ? "Your email is already verified. Refresh the page." : `We sent a new link to ${email}.`);
    } catch (e) {
      setState("error");
      setMsg(e instanceof ApiClientError ? e.message : "Could not send the email. Try again.");
    }
  }
  return (
    <div className="panel flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-gold-400 p-4">
      <p className="text-sm">
        <strong>Please confirm your email.</strong> We sent a link to {email}. Confirming it also adds any earlier orders you placed with this email to your account.
      </p>
      <div className="flex items-center gap-3">
        {msg && <p role={state === "error" ? "alert" : "status"} className={`text-sm ${state === "error" ? "text-danger" : "text-success"}`}>{msg}</p>}
        <button type="button" className="btn-outline btn-sm" onClick={resend} disabled={state === "busy" || state === "sent"}>{state === "busy" ? "Sending…" : "Send a new link"}</button>
      </div>
    </div>
  );
}
