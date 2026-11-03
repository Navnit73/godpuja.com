// Shared (client + server safe). International postal addresses, PRD v1.1 §13 / §15.

export type Address = { name: string; line1: string; line2?: string; city: string; state: string; postalCode: string; country: string };

type Rule = { postal?: RegExp; postalRequired: boolean; postalLabel: string; stateLabel: string; stateRequired: boolean };

const DEFAULT_RULE: Rule = { postal: /^[A-Z0-9][A-Z0-9 -]{1,9}$/, postalRequired: true, postalLabel: "Postal code", stateLabel: "State / region (optional)", stateRequired: false };

/** Countries with known formats. Others use DEFAULT_RULE. Postal codes are compared upper-cased. */
const RULES: Record<string, Rule> = {
  IN: { postal: /^\d{6}$/, postalRequired: true, postalLabel: "PIN code", stateLabel: "State", stateRequired: true },
  US: { postal: /^\d{5}(-\d{4})?$/, postalRequired: true, postalLabel: "ZIP code", stateLabel: "State", stateRequired: true },
  CA: { postal: /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/, postalRequired: true, postalLabel: "Postal code", stateLabel: "Province", stateRequired: true },
  GB: { postal: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/, postalRequired: true, postalLabel: "Postcode", stateLabel: "County (optional)", stateRequired: false },
  AU: { postal: /^\d{4}$/, postalRequired: true, postalLabel: "Postcode", stateLabel: "State", stateRequired: true },
  NZ: { postal: /^\d{4}$/, postalRequired: true, postalLabel: "Postcode", stateLabel: "Region (optional)", stateRequired: false },
  SG: { postal: /^\d{6}$/, postalRequired: true, postalLabel: "Postal code", stateLabel: "Region (optional)", stateRequired: false },
  AE: { postalRequired: false, postalLabel: "Postal code (optional)", stateLabel: "Emirate", stateRequired: true },
  HK: { postalRequired: false, postalLabel: "Postal code (optional)", stateLabel: "District (optional)", stateRequired: false },
};

export const addressRule = (country: string): Rule => RULES[country] ?? DEFAULT_RULE;

const names = new Map<string, Intl.DisplayNames>();
/** English (or `locale`) name of an ISO 3166-1 alpha-2 code, or undefined if unknown. */
export function countryName(code: string, locale = "en"): string | undefined {
  if (!/^[A-Z]{2}$/.test(code)) return undefined;
  let dn = names.get(locale);
  if (!dn) { dn = new Intl.DisplayNames([locale], { type: "region", fallback: "none" }); names.set(locale, dn); }
  try { return dn.of(code) ?? undefined; } catch { return undefined; }
}

// Codes Intl names that are not countries/territories you can post to.
const NOT_COUNTRIES = new Set(["AC", "CP", "CQ", "DG", "EA", "EU", "EZ", "IC", "QO", "TA", "UN", "XA", "XB", "ZZ"]);
export const isCountry = (code: string) => !NOT_COUNTRIES.has(code) && countryName(code) !== undefined;

/** All countries, sorted by name. Compute on the server and pass down (ICU data can differ between runtimes). */
export function allCountries(locale = "en"): { code: string; name: string }[] {
  const out: { code: string; name: string }[] = [];
  for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
    const code = String.fromCharCode(a, b);
    if (!isCountry(code)) continue;
    out.push({ code, name: countryName(code, locale)! });
  }
  return out.sort((x, y) => x.name.localeCompare(y.name, locale));
}

/** Field errors for an address (keys are Address fields). Empty object = valid. */
export function addressIssues(a: Pick<Address, "country" | "postalCode" | "state">): Partial<Record<"country" | "postalCode" | "state", string>> {
  const issues: Partial<Record<"country" | "postalCode" | "state", string>> = {};
  if (!isCountry(a.country)) { issues.country = "Choose a country"; return issues; }
  const r = addressRule(a.country);
  if (!a.postalCode) { if (r.postalRequired) issues.postalCode = `Enter the ${r.postalLabel}`; }
  else if (r.postal && !r.postal.test(a.postalCode)) issues.postalCode = `Enter a valid ${r.postalLabel.replace(/ \(optional\)$/, "")}`;
  if (r.stateRequired && a.state.length < 2) issues.state = `Enter the ${r.stateLabel.toLowerCase()}`;
  return issues;
}

/** Orders placed before Stage 12 stored `pincode` instead of `postalCode`. */
export function normalizeAddress(a: Partial<Address> & { pincode?: string }): Address {
  return {
    name: a.name ?? "", line1: a.line1 ?? "", ...(a.line2 ? { line2: a.line2 } : {}), city: a.city ?? "", state: a.state ?? "",
    postalCode: a.postalCode ?? a.pincode ?? "", country: a.country ?? "IN",
  };
}

/** One-line-per-part rendering used by order views and emails. */
export const addressLines = (a: Address): string[] =>
  [a.name, a.line1, a.line2, [a.city, [a.state, a.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", "), countryName(a.country) ?? a.country]
    .filter((x): x is string => !!x);
