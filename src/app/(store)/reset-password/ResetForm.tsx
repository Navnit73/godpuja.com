"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { TextField } from "@/components/store/AddressFields";
import { api, ApiClientError } from "@/lib/api";

export default function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field?: string; text: string; badLink?: boolean } | null>(null);

  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return <p role="alert" className="alert-error">This link is not valid. <Link href="/forgot-password" className="underline">Request a new one</Link>.</p>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const r = await api.post<{ role: string }>("/auth/reset-password", { token, password });
      router.replace(r.role === "customer" ? "/account" : "/admin");
      router.refresh();
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiClientError) setError({ field: err.fields?.password, text: err.message, badLink: !!err.fields?.token });
      else setError({ text: "Could not reset your password. Try again." });
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error && !error.field && <p role="alert" className="alert-error">{error.text}{error.badLink && <> <Link href="/forgot-password" className="underline">Request a new link</Link>.</>}</p>}
      <TextField id="password" label="New password" type="password" autoComplete="new-password" value={password} onChange={setPassword} error={error?.field} />
      <p className="text-xs text-muted">At least 10 characters with a letter and a number.</p>
      <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? "Saving…" : "Set new password"}</button>
    </form>
  );
}
