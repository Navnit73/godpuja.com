import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h2", "h3", "h4", "p", "br", "hr", "strong", "em", "del", "blockquote", "ul", "ol", "li",
    "a", "img", "code", "pre", "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading", "referrerpolicy"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    // Page title is the only h1; demote any h1 an author writes.
    h1: "h2",
    a: (tag, attribs) => {
      const external = /^https?:\/\//i.test(attribs.href ?? "");
      return { tagName: "a", attribs: { ...attribs, ...(external ? { target: "_blank", rel: "noopener noreferrer" } : {}) } };
    },
    img: (tag, attribs) => ({ tagName: "img", attribs: { ...attribs, loading: "lazy", referrerpolicy: "no-referrer" } }),
  },
};

/** Markdown -> sanitized HTML. Sanitization is the security boundary; always applied at render time. */
export function renderMarkdown(markdown: string): string {
  const raw = marked.parse(markdown ?? "", { async: false, gfm: true, breaks: false }) as string;
  return sanitizeHtml(raw, OPTIONS);
}
