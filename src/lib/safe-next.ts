/** Same-site relative redirect targets only. Rejects //host, /\host, absolute URLs and control chars. */
export function safeNext(n: string | null | undefined, fallback = "/admin") {
  if (!n || !n.startsWith("/") || n.startsWith("//") || /[\\\u0000-\u001f]/.test(n)) return fallback;
  try {
    const u = new URL(n, "http://local.invalid");
    return u.origin === "http://local.invalid" ? u.pathname + u.search + u.hash : fallback;
  } catch {
    return fallback;
  }
}
