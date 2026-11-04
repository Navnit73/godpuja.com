"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TextField } from "@/components/store/AddressFields";
import { api, ApiClientError } from "@/lib/api";
import { resetWishlist } from "@/lib/wishlist-store";

export default function RegisterForm() {
  const router = useRouter();
  const [v, setV] = useState({ name: "", email: "", password: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const up = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null); setErrs({});
    try {
      await api.post("/auth/register", v);
      resetWishlist();
      router.replace("/account");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) { setErrs(err.fields ?? {}); setError(err.fields ? "Please fix the highlighted fields." : err.message); }
      else setError("Could not create your account. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error && <p role="alert" className="alert-error">{error}</p>}
      <TextField id="name" label="Name" autoComplete="name" value={v.name} onChange={up("name")} error={errs.name} />
      <TextField id="email" label="Email" type="email" autoComplete="email" value={v.email} onChange={up("email")} error={errs.email} />
      <TextField id="password" label="Password" type="password" autoComplete="new-password" value={v.password} onChange={up("password")} error={errs.password} />
      <p className="text-xs text-muted">At least 10 characters with a letter and a number.</p>
      <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
    </form>
  );
}
