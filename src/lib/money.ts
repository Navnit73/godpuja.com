// Shared (client + server safe). Money is integer minor units (paise for INR) plus an ISO 4217 currency code.
// Never do arithmetic on floats: convert to minor units at the edge (forms) and keep integers everywhere else.

/**
 * Accounting and catalogue currency (PRD v1.1 §13, PROJECT_PRD decision 9). Product prices are in this currency;
 * every order records the currency it was charged in. Multi-currency display is Phase 3.
 */
export const BASE_CURRENCY = "INR";

const digitsCache = new Map<string, number>();
/** Number of minor-unit digits for a currency (INR 2, JPY 0, KWD 3). */
export function minorDigits(currency: string): number {
  let d = digitsCache.get(currency);
  if (d === undefined) {
    d = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    digitsCache.set(currency, d);
  }
  return d;
}

/** True for a well-formed ISO 4217 code that Intl can format. */
export function isCurrency(code: string): boolean {
  if (!/^[A-Z]{3}$/.test(code)) return false;
  try { new Intl.NumberFormat("en", { style: "currency", currency: code }); return true; } catch { return false; }
}

const fmtCache = new Map<string, Intl.NumberFormat>();
function formatter(currency: string, whole: boolean) {
  const key = `${currency}:${whole}`;
  let f = fmtCache.get(key);
  if (!f) {
    // en-IN for rupees (₹1,00,000); a neutral English locale otherwise. Deterministic so SSR and client match.
    const d = whole ? 0 : minorDigits(currency);
    f = new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en", { style: "currency", currency, minimumFractionDigits: d, maximumFractionDigits: d });
    fmtCache.set(key, f);
  }
  return f;
}

/** Whole amounts without decimals, others with all of them: 10000 -> "₹100", 19950 -> "₹199.50" (never "₹199.5"). `null` -> "—". */
export function formatMoney(minor: number | null | undefined, currency: string = BASE_CURRENCY): string {
  if (minor == null) return "—";
  const unit = 10 ** minorDigits(currency);
  return formatter(currency, minor % unit === 0).format(minor / unit);
}

/** Plain decimal string for CSV/exports: 19950 INR -> "199.50". */
export const minorToDecimal = (minor: number, currency: string = BASE_CURRENCY) => {
  const d = minorDigits(currency);
  return (minor / 10 ** d).toFixed(d);
};

// Admin price inputs are in BASE_CURRENCY (INR, 2 decimals).
/** "199.50" -> 19950. Returns null for empty, NaN for garbage (so validation can flag it). */
export function rupeesToPaise(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN;
  return Math.round(parseFloat(t) * 100);
}
export const paiseToRupees = (p: number | null | undefined) => (p == null ? "" : (p / 100).toFixed(2).replace(/\.00$/, ""));
