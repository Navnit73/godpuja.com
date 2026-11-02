/* eslint-disable @next/next/no-img-element -- remote CMS images from any host; Cloudinary ones are resized via lib/image */
import Link from "next/link";
import type { PublicPage, PublicSection } from "@/server/services/pages";
import { responsive } from "@/lib/image";

function Html({ html, className = "" }: { html: string; className?: string }) {
  // Sanitized server-side by renderMarkdown (sanitize-html allowlist).
  return <div className={`content ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Section({ s }: { s: PublicSection }) {
  if (s.type === "richtext") return <Html html={s.html} />;
  const external = /^https?:\/\//i.test(s.ctaUrl);
  return (
    <div className={`grid items-center gap-8 ${s.imageUrl ? "md:grid-cols-2" : ""} ${s.imageUrl && s.imagePosition === "right" ? "md:[&>*:first-child]:order-2" : ""}`}>
      {s.imageUrl && <img {...responsive(s.imageUrl, "(min-width: 768px) 50vw, 100vw", 640)} alt={s.imageAlt} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-auto w-full rounded-xl" />}
      <div>
        {s.heading && <h2 className="text-3xl font-semibold">{s.heading}</h2>}
        <Html html={s.bodyHtml} className={s.heading ? "mt-3" : ""} />
        {s.ctaLabel && s.ctaUrl && (
          <div className="mt-5">
            {external
              ? <a href={s.ctaUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">{s.ctaLabel}</a>
              : <Link href={s.ctaUrl} className="btn-primary">{s.ctaLabel}</Link>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PageView({ page }: { page: PublicPage }) {
  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
    <article>
      {page.isPreview && (
        <p role="status" className="mb-6 rounded-md border border-gold-300 bg-warning-soft px-3 py-2 text-sm text-warning">
          Preview — this page is not published and is hidden from search engines.
        </p>
      )}
      <h1 className="text-4xl font-semibold sm:text-5xl">{page.title}</h1>
      {page.description && <p className="mt-3 text-lg text-muted">{page.description}</p>}
      <div className="divider-gold my-8" />
      <div className="space-y-12">{page.sections.map((s) => <Section key={s.id} s={s} />)}</div>
    </article>
    </main>
  );
}
