const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** First URL segments owned by the app; CMS pages may not use them. */
export const RESERVED_SLUGS = [
  "admin", "api", "login", "logout", "register", "account", "cart", "checkout", "order", "orders",
  "category", "categories", "product", "products", "search", "preview", "sitemap.xml", "robots.txt",
  "_next", "favicon.ico", "icon.svg", "apple-icon.png", "icon", "page-not-found",
] as const;

export function slugify(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** 1–3 lowercase kebab segments, e.g. "about" or "services/graha-shanti". */
export function validateSlug(slug: string): string | null {
  const parts = slug.split("/");
  if (parts.length > 3) return "Use at most 3 path levels";
  if (!parts.every((p) => SEGMENT.test(p) && p.length <= 80)) return "Use lowercase letters, numbers and single hyphens";
  if ((RESERVED_SLUGS as readonly string[]).includes(parts[0])) return `"${parts[0]}" is reserved`;
  return null;
}
