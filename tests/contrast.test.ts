// Manual-contrast check made automatic: every text/background pairing the design system uses must meet WCAG 2.1 AA
// (4.5:1 body text, 3:1 large text and UI components such as focus rings). Colors are read from globals.css, so a
// token change that breaks contrast fails the build.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = fs.readFileSync(path.resolve(__dirname, "../src/app/globals.css"), "utf8");
const vars = new Map<string, string>();
for (const m of css.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) if (!vars.has(m[1])) vars.set(m[1], m[2].trim());
const resolve = (name: string, depth = 0): string => {
  const v = vars.get(name);
  if (!v) throw new Error(`token ${name} not found`);
  const ref = /^var\((--[a-z0-9-]+)\)$/.exec(v);
  return ref && depth < 10 ? resolve(ref[1], depth + 1) : v;
};
const lum = (hex: string) => {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a: string, b: string) => {
  const [x, y] = [lum(resolve(a)), lum(resolve(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [foreground, background, minimum, where it is used]
const PAIRS: [string, string, number, string][] = [
  ["--foreground", "--background", 4.5, "body text on page"],
  ["--foreground", "--surface", 4.5, "text on cards / inputs"],
  ["--muted", "--background", 4.5, "secondary text on page"],
  ["--muted", "--surface", 4.5, "secondary text on cards"],
  ["--muted", "--color-sandal-100", 4.5, "secondary text on soft panels (hero, placeholders)"],
  ["--primary-foreground", "--primary", 4.5, "primary button label"],
  ["--primary", "--background", 4.5, "links / outline buttons on page"],
  ["--primary", "--surface", 4.5, "links / outline buttons on cards"],
  ["--color-danger", "--surface", 4.5, "error text"],
  ["--color-danger", "--color-danger-soft", 4.5, "error banner"],
  ["--color-success", "--color-success-soft", 4.5, "success banner"],
  ["--color-warning", "--color-warning-soft", 4.5, "warning banner"],
  ["--color-kumkum-900", "--color-saffron-200", 4.5, "selected text"],
  // Storefront refresh: sacred gradient stops, dark footer / top bar, dawn bands
  ["--primary-foreground", "--color-saffron-700", 4.5, "white text on sacred gradient start"],
  ["--primary-foreground", "--color-kumkum-600", 4.5, "white text on sacred gradient middle"],
  ["--color-sandal-100", "--color-saffron-700", 4.5, "hero subheading on sacred gradient start"],
  ["--color-sandal-100", "--color-kumkum-800", 4.5, "offer text on dusk gradient"],
  ["--primary-foreground", "--color-kumkum-700", 4.5, "discount badge"],
  ["--color-sandal-200", "--color-kumkum-950", 4.5, "footer / top bar text"],
  ["--color-sandal-300", "--color-kumkum-950", 4.5, "footer copyright"],
  ["--color-gold-300", "--color-kumkum-950", 4.5, "footer headings / link hover"],
  ["--color-gold-300", "--color-kumkum-800", 4.5, "footer headings on dusk gradient start"],
  ["--muted", "--color-saffron-50", 4.5, "secondary text on dawn band"],
  ["--primary", "--color-saffron-50", 4.5, "View all pill / links on dawn band"],
  ["--color-success", "--color-saffron-50", 4.5, "added-to-cart status on dawn panel"],
  ["--input-border", "--surface", 3, "form control edge (non-text)"],
  ["--input-border", "--background", 3, "form control edge on page (non-text)"],
  ["--accent", "--background", 3, "focus ring on page (non-text)"],
  ["--accent", "--surface", 3, "focus ring on cards (non-text)"],
];

describe("design token contrast (WCAG 2.1 AA)", () => {
  it.each(PAIRS)("%s on %s >= %s:1 (%s)", (fg, bg, min) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(min);
  });
});
