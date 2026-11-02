// Deterministic (fixed time zone) so server and client render identically.
const TZ = "Asia/Kolkata";
const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: TZ });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: TZ });

export const formatDate = (iso: string | null | undefined, empty = "—") => (iso ? dateFmt.format(new Date(iso)) : empty);
export const formatDateTime = (iso: string | null | undefined, empty = "—") => (iso ? `${dateTimeFmt.format(new Date(iso))} IST` : empty);

/** "YYYY-MM-DDTHH:mm" typed in a datetime-local input, interpreted as India Standard Time -> ISO string. */
export const istInputToIso = (v: string) => new Date(`${v}:00+05:30`).toISOString();
