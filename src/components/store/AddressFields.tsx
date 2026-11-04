"use client";

import { addressRule, type Address } from "@/lib/address";

export type Country = { code: string; name: string };

export function TextField({ id, label, value, onChange, error, ...rest }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "id">) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <input id={id} className="input" value={value} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} onChange={(e) => onChange(e.target.value)} {...rest} />
      {error && <p id={`${id}-err`} className="field-error">{error}</p>}
    </div>
  );
}

/**
 * Country-aware address inputs (labels and rules from lib/address). `errs` uses "<prefix>.<field>" keys, matching the
 * API's field errors. With a single country it shows the country as text (`note` explains why).
 */
export default function AddressFields({ prefix, a, set, errs, countries, note }: { prefix: string; a: Address; set: (a: Address) => void; errs: Record<string, string>; countries: Country[]; note?: string }) {
  const e = (k: string) => errs[`${prefix}.${k}`];
  const up = (k: keyof Address) => (v: string) => set({ ...a, [k]: v });
  const rule = addressRule(a.country);
  const countryErr = e("country");
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor={`${prefix}-country`} className="label">Country</label>
        {countries.length === 1
          ? <p id={`${prefix}-country`} className="text-sm">{countries[0].name}{note && <span className="text-muted"> — {note}</span>}</p>
          : <select id={`${prefix}-country`} className="input" autoComplete="country" value={a.country} aria-invalid={!!countryErr} aria-describedby={countryErr ? `${prefix}-country-err` : undefined}
              onChange={(ev) => set({ ...a, country: ev.target.value, state: "", postalCode: "" })}>
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>}
        {countryErr && <p id={`${prefix}-country-err`} className="field-error">{countryErr}</p>}
      </div>
      <div className="sm:col-span-2"><TextField id={`${prefix}-name`} label="Full name" autoComplete="name" value={a.name} onChange={up("name")} error={e("name")} /></div>
      <div className="sm:col-span-2"><TextField id={`${prefix}-line1`} label="Address" autoComplete="address-line1" value={a.line1} onChange={up("line1")} error={e("line1")} /></div>
      <div className="sm:col-span-2"><TextField id={`${prefix}-line2`} label="Apartment, landmark (optional)" autoComplete="address-line2" value={a.line2 ?? ""} onChange={up("line2")} error={e("line2")} /></div>
      <TextField id={`${prefix}-city`} label="City" autoComplete="address-level2" value={a.city} onChange={up("city")} error={e("city")} />
      <TextField id={`${prefix}-state`} label={rule.stateLabel} autoComplete="address-level1" value={a.state} onChange={up("state")} error={e("state")} />
      <TextField id={`${prefix}-postalCode`} label={rule.postalLabel} inputMode={a.country === "IN" || a.country === "US" ? "numeric" : "text"} maxLength={12} autoComplete="postal-code" value={a.postalCode} onChange={up("postalCode")} error={e("postalCode")} />
    </div>
  );
}
