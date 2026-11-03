// Shared (client + server safe). Timestamps are stored in UTC; anything tied to a place (temples, admin reports)
// carries an IANA time zone and is converted here. PRD v1.1 §13, §15.1. No dependencies: Intl only.

export function isTimeZone(tz: string): boolean {
  if (!tz) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; }
}

const partsFmt = new Map<string, Intl.DateTimeFormat>();
/** Offset of `tz` from UTC at instant `at`, in ms (Asia/Kolkata = +19 800 000). */
export function tzOffsetMs(tz: string, at: Date): number {
  let f = partsFmt.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    partsFmt.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return wall - Math.floor(at.getTime() / 1000) * 1000;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Wall-clock date + time in `tz` -> UTC instant. "2026-11-03", "06:30", "Asia/Kolkata" -> 2026-11-03T01:00:00Z.
 * A time inside a DST gap (does not exist locally) resolves to a nearby valid instant; avoid scheduling slots there.
 */
export function zonedToUtc(day: string, time: string, tz: string): Date {
  if (!DAY.test(day) || !TIME.test(time)) throw new RangeError(`Invalid local date/time: ${day} ${time}`);
  if (!isTimeZone(tz)) throw new RangeError(`Invalid time zone: ${tz}`);
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  if (new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) !== day) throw new RangeError(`Invalid date: ${day}`); // 2026-13-01, 2026-02-30
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  const first = wall - tzOffsetMs(tz, new Date(wall));
  const second = wall - tzOffsetMs(tz, new Date(first)); // corrects when the offset differs either side of a DST change
  return new Date(second);
}

/** "YYYY-MM-DD" one day later (pure calendar arithmetic). */
export const nextDay = (day: string) => new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) + 1)).toISOString().slice(0, 10);

/** [start, end] UTC instants covering the whole local calendar day `day` in `tz` (end is inclusive, 1 ms before the next day). */
export function dayRangeUtc(day: string, tz: string): { start: Date; end: Date } {
  const start = zonedToUtc(day, "00:00", tz);
  const end = new Date(zonedToUtc(nextDay(day), "00:00", tz).getTime() - 1);
  return { start, end };
}

/** Local calendar day ("YYYY-MM-DD") of an instant in `tz`. */
export const localDay = (at: Date, tz: string) => new Date(at.getTime() + tzOffsetMs(tz, at)).toISOString().slice(0, 10);

/** Short zone label at an instant, e.g. "GMT+5:30", "EST", "BST" (depends on ICU data). */
export function zoneLabel(tz: string, at: Date = new Date(), locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, { timeZone: tz, timeZoneName: "short" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? tz;
}

/** "3 Nov 2026, 6:30 am IST"-style string in a given zone, always with the zone shown (PRD §6.4: label the timezone). */
export function formatInZone(at: Date | string, tz: string, locale = "en-IN"): string {
  const d = typeof at === "string" ? new Date(at) : at;
  const s = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: tz }).format(d);
  return `${s} ${tz === "Asia/Kolkata" ? "IST" : zoneLabel(tz, d)}`;
}
