// Prices are stored as integer paise; the admin UI edits rupees.
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const formatPaise = (p: number | null | undefined) => (p == null ? "—" : inr.format(p / 100));
/** "199.50" -> 19950. Returns null for empty, NaN for garbage (so validation can flag it). */
export function rupeesToPaise(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN;
  return Math.round(parseFloat(t) * 100);
}
export const paiseToRupees = (p: number | null | undefined) => (p == null ? "" : (p / 100).toFixed(2).replace(/\.00$/, ""));
