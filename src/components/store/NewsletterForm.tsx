"use client";

import { useEffect, useId, useRef, useState } from "react";
import { api, ApiClientError } from "@/lib/api";

export default function NewsletterForm() {
  const id = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const doneRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (state === "done") doneRef.current?.focus(); }, [state]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("busy");
    setError(null);
    const _hp = String(new FormData(e.currentTarget).get("contact_url_hp") ?? "");
    try {
      await api.post("/newsletter", { email, _hp });
      setState("done");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.fields?.email ?? err.message : "Could not subscribe. Try again.");
      setState("idle");
    }
  }

  if (state === "done") return <p ref={doneRef} tabIndex={-1} role="status" className="font-medium text-success outline-none">Thank you — you are subscribed.</p>;
  return (
    <form onSubmit={submit} noValidate className="space-y-2">
      <label htmlFor={id} className="label">Email address</label>
      <div className="flex gap-2">
        <input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="input min-w-0 flex-1" aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} />
        <button type="submit" className="btn-primary shrink-0" disabled={state === "busy"}>{state === "busy" ? "Please wait…" : "Subscribe"}</button>
      </div>
      {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px]"><input name="contact_url_hp" tabIndex={-1} autoComplete="off" data-lpignore="true" data-1p-ignore /></div>
      {error && <p id={`${id}-err`} role="alert" className="field-error">{error}</p>}
    </form>
  );
}
