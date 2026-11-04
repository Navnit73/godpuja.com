"use client";

import { useState } from "react";
import { TextField } from "@/components/store/AddressFields";
import { api, ApiClientError } from "@/lib/api";

export default function ForgotForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState<{ field?: string; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setState("busy"); setError(null);
    try { await api.post("/auth/forgot-password", { email }); setState("sent"); }
    catch (err) {
      setState("idle");
      setError(err instanceof ApiClientError ? { field: err.fields?.email, text: err.message } : { text: "Could not send the email. Try again." });
    }
  }

  // Same message whether or not the email has an account.
  if (state === "sent") return <p role="status" className="alert-success">If an account exists for {email}, a reset link is on its way. It works once and expires in 1 hour. Check your spam folder too.</p>;
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error && !error.field && <p role="alert" className="alert-error">{error.text}</p>}
      <TextField id="email" label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} error={error?.field} />
      <button type="submit" className="btn-primary w-full" disabled={state === "busy"}>{state === "busy" ? "Sending…" : "Send reset link"}</button>
    </form>
  );
}
