/**
 * Built-in storefront listings offered in the menu and footer "Links to" pickers. They are stored as ordinary
 * custom links (type "external" + an internal path), so no schema change is needed; the picker just recognises them.
 */
export const SECTION_LINKS = [
  { key: "shop", option: "Shop (all products)", label: "Shop", url: "/shop" },
  { key: "pooja-vidhi", option: "Pooja Vidhi (all guides)", label: "Pooja Vidhi", url: "/pooja-vidhi" },
  { key: "blog", option: "Blog (all posts)", label: "Blog", url: "/blog" },
  { key: "guides", option: "Guides (all guides)", label: "Guides", url: "/guides" },
] as const;

export type LinkTarget = "page" | "external" | (typeof SECTION_LINKS)[number]["key"];
type Linkish = { type: "page" | "external"; url?: string; label: string };

/** Which picker option a stored link corresponds to. */
export function targetOf(l: Linkish): LinkTarget {
  if (l.type === "page") return "page";
  return SECTION_LINKS.find((s) => s.url === l.url)?.key ?? "external";
}

/** Patch to apply when the admin picks `target`. Fills an empty label with the section name. */
export function patchForTarget(target: LinkTarget, l: Linkish): { type: "page" | "external"; url?: string; label?: string } {
  if (target === "page") return { type: "page" };
  const s = SECTION_LINKS.find((x) => x.key === target);
  if (!s) return { type: "external", url: SECTION_LINKS.some((x) => x.url === l.url) ? "" : l.url };
  return { type: "external", url: s.url, ...(l.label.trim() ? {} : { label: s.label }) };
}
