"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TextField, type Country } from "@/components/store/AddressFields";
import { api, ApiClientError } from "@/lib/api";
import type { Profile } from "@/server/services/account";

const LANG = [{ code: "en", name: "English" }, { code: "hi", name: "हिन्दी (Hindi) — coming soon" }];

function Select({ id, label, value, onChange, children, error }: { id: string; label: string; value: string; onChange: (v: string) => void; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined}>{children}</select>
      {error && <p id={`${id}-err`} className="field-error">{error}</p>}
    </div>
  );
}

export default function ProfileClient({ initial, countries, currencies, timeZones }: { initial: Profile; countries: Country[]; currencies: string[]; timeZones: string[] }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [form, setForm] = useState({ name: initial.name, phone: initial.phone, ...initial.prefs });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [pwErrs, setPwErrs] = useState<Record<string, string>>({});
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);
  const up = (k: keyof typeof form) => (v: string) => setForm({ ...form, [k]: v });

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null); setErrs({});
    try {
      const next = await api.patch<Profile>("/account/profile", { name: form.name, phone: form.phone, prefs: { country: form.country, language: form.language, currency: form.currency, timezone: form.timezone } });
      setP(next); setMsg({ ok: true, text: "Profile saved" }); router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) { setErrs(Object.fromEntries(Object.entries(err.fields ?? {}).map(([k, v]) => [k.replace(/^prefs\./, ""), v]))); setMsg({ ok: false, text: err.fields ? "Please fix the highlighted fields." : err.message }); }
      else setMsg({ ok: false, text: "Could not save. Try again." });
    } finally { setBusy(false); }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault(); setPwBusy(true); setPwMsg(null); setPwErrs({});
    try {
      await api.post("/account/password", p.hasPassword ? pw : { newPassword: pw.newPassword });
      setPw({ currentPassword: "", newPassword: "" }); setP({ ...p, hasPassword: true });
      setPwMsg({ ok: true, text: "Password changed. You have been signed out on your other devices." });
    } catch (err) {
      if (err instanceof ApiClientError) { setPwErrs(err.fields ?? {}); setPwMsg({ ok: false, text: err.fields ? "Please fix the highlighted fields." : err.message }); }
      else setPwMsg({ ok: false, text: "Could not change the password. Try again." });
    } finally { setPwBusy(false); }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={saveProfile} noValidate className="panel space-y-4 p-5" aria-labelledby="profile-h">
        <h2 id="profile-h" className="font-sans text-lg font-semibold">Profile</h2>
        {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "alert-success" : "alert-error"}>{msg.text}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="name" label="Name" autoComplete="name" value={form.name} onChange={up("name")} error={errs.name} />
          <TextField id="phone" label="Phone (optional)" type="tel" autoComplete="tel" value={form.phone} onChange={up("phone")} error={errs.phone} />
          <div className="sm:col-span-2">
            <p className="label">Email</p>
            <p className="text-sm">{p.email} <span className={p.emailVerified ? "badge-success" : "badge-muted"}>{p.emailVerified ? "Verified" : "Not verified"}</span>{p.google && <span className="ml-2 text-xs text-muted">Signed in with Google</span>}</p>
          </div>
          <Select id="country" label="Country" value={form.country} onChange={up("country")} error={errs.country}>{countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</Select>
          <Select id="language" label="Language" value={form.language} onChange={up("language")} error={errs.language}>{LANG.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}</Select>
          <Select id="currency" label="Preferred currency" value={form.currency} onChange={up("currency")} error={errs.currency}>{currencies.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
          <Select id="timezone" label="Time zone" value={form.timezone} onChange={up("timezone")} error={errs.timezone}>{timeZones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}</Select>
        </div>
        <p className="text-xs text-muted">Prices are charged in Indian Rupees for now; your preferred currency is saved for when more currencies are available.</p>
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
      </form>

      <form onSubmit={savePassword} noValidate className="panel space-y-4 p-5" aria-labelledby="pw-h">
        <h2 id="pw-h" className="font-sans text-lg font-semibold">{p.hasPassword ? "Change password" : "Set a password"}</h2>
        {!p.hasPassword && <p className="text-sm text-muted">You sign in with Google. Set a password to also sign in with your email.</p>}
        {pwMsg && <p role={pwMsg.ok ? "status" : "alert"} className={pwMsg.ok ? "alert-success" : "alert-error"}>{pwMsg.text}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {p.hasPassword && <TextField id="currentPassword" label="Current password" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(v) => setPw({ ...pw, currentPassword: v })} error={pwErrs.currentPassword} />}
          <TextField id="newPassword" label="New password" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(v) => setPw({ ...pw, newPassword: v })} error={pwErrs.newPassword} />
        </div>
        <p id="pw-hint" className="text-xs text-muted">At least 10 characters with a letter and a number. Changing it signs you out on other devices.</p>
        <button type="submit" className="btn-primary" disabled={pwBusy}>{pwBusy ? "Saving…" : p.hasPassword ? "Change password" : "Set password"}</button>
      </form>
    </div>
  );
}
