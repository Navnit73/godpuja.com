// Shared (client + server safe). Storefront filters beyond price (PRD v1.1 §5.2): deity, material, occasion, size,
// availability and rating. A facet is a product attribute with that name (case-insensitive); only values that exist on
// products are offered ("Filters should only expose attributes supported by the data", §6.1 applies here too).
export const FACETS = [
  { key: "deity", name: "Deity" },
  { key: "material", name: "Material" },
  { key: "occasion", name: "Occasion" },
  { key: "size", name: "Size" },
] as const;
export type FacetKey = (typeof FACETS)[number]["key"];
export const FACET_KEYS = FACETS.map((f) => f.key) as [FacetKey, ...FacetKey[]];
export const MIN_RATINGS = [4, 3] as const;
export const MAX_FACET_VALUES = 40;
export const FACET_VALUE_MAX = 60;
