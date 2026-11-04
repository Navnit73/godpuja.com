// Pure helper for scripts/migrate-stage15.ts (kept in src so tests can import it without running a script).
type Section = { type: string; enabled?: boolean; data?: Record<string, string> };

/** Old guide sections -> one Markdown text, in order, skipping hidden sections. */
export function sectionsToMarkdown(sections: Section[]): string {
  return sections.filter((s) => s.enabled !== false).map((s) => {
    const d = s.data ?? {};
    if (s.type === "richtext") return (d.markdown ?? "").trim();
    const parts = [d.heading ? `## ${d.heading}` : "", (d.markdown ?? "").trim(), d.imageUrl ? `![${d.imageAlt ?? ""}](${d.imageUrl})` : ""];
    return parts.filter(Boolean).join("\n\n");
  }).filter(Boolean).join("\n\n");
}
export type { Section };
