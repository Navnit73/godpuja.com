import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import JsonLd from "@/components/JsonLd";
import { articleLd, breadcrumbLd } from "@/lib/jsonld";
import {
  AARTI_BASE, DEVOTIONAL_LANGUAGES, DEVOTIONAL_TYPES, devotionalHref, MANTRA_BASE, MANTRA_TYPE_KEYS, publicDevotionalSchema, type DevotionalType,
} from "@/lib/validation/devotional";
import { env } from "@/server/env";
import { getPublicDevotional, getPublicDevotionalList } from "@/server/public/devotional";
import { getSiteSettings } from "@/server/public/settings";
import DevotionalCardView from "./DevotionalCardView";
import DevotionalView from "./DevotionalView";
import PageBand from "./PageBand";

export type Section = "aarti" | "mantras";
const CFG = {
  aarti: { base: AARTI_BASE, title: "Aarti", types: ["aarti"] as readonly DevotionalType[], intro: "Aarti lyrics with meaning, and recordings where we have the right to share them." },
  mantras: { base: MANTRA_BASE, title: "Mantras", types: MANTRA_TYPE_KEYS as readonly DevotionalType[], intro: "Mantras, chalisas and stotras with their meaning, and recordings where we have the right to share them." },
} as const;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type Raw = Record<string, string | string[] | undefined>;
const parse = (raw: Raw) => {
  const pick = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : undefined);
  const r = publicDevotionalSchema.safeParse({ type: pick("type"), deity: pick("deity"), language: pick("language"), q: pick("q"), page: pick("page") });
  return r.success ? r.data : publicDevotionalSchema.parse({}); // a bad parameter shows the plain list instead of an error
};
const href = (base: string, q: { type?: string; deity?: string; language?: string; q?: string }, page = 1) => {
  const p = new URLSearchParams();
  for (const k of ["type", "deity", "language", "q"] as const) if (q[k]) p.set(k, q[k]!);
  if (page > 1) p.set("page", String(page));
  const s = p.toString();
  return `${base}${s ? `?${s}` : ""}`;
};

export async function indexMetadata(section: Section, searchParams: Promise<Raw>): Promise<Metadata> {
  await connection();
  const { base, title, intro } = CFG[section];
  const q = parse(await searchParams);
  const filtered = !!(q.type || q.deity || q.language || q.q);
  const canonical = `${env().SITE_URL.replace(/\/$/, "")}${filtered ? base : href(base, {}, q.page)}`; // filtered views canonicalise to the plain list
  return { title: q.page > 1 ? `${title} — page ${q.page}` : title, description: intro, alternates: { canonical }, robots: filtered ? { index: false, follow: true } : undefined, openGraph: { type: "website", title, description: intro, url: canonical } };
}

export async function IndexContent({ section, searchParams }: { section: Section; searchParams: Promise<Raw> }) {
  await connection();
  const { base, title, types, intro } = CFG[section];
  const q = parse(await searchParams);
  const r = await getPublicDevotionalList({ types, type: q.type, deity: q.deity, language: q.language, q: q.q, page: q.page, limit: q.limit });
  const total = Object.values(r.typeCounts).reduce((a, b) => a + (b ?? 0), 0);
  const filtered = !!(q.type || q.deity || q.language || q.q);
  const typeChips = DEVOTIONAL_TYPES.filter((t) => types.includes(t.key) && (r.typeCounts[t.key] ?? 0) > 0);
  return (
    <main id="main" tabIndex={-1} className="w-full flex-1">
      <PageBand title={title} description={intro} crumbs={[{ name: "Home", href: "/" }, { name: title }]} />
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        {total > 0 && (
          <>
            {section === "mantras" && typeChips.length > 1 && (
              <nav aria-label="Types" className="mb-4">
                <ul className="flex flex-wrap gap-2">
                  <li><Link href={href(base, { ...q, type: undefined })} aria-current={!q.type ? "true" : undefined} className={`chip ${!q.type ? "border-primary text-primary" : ""}`}>All</Link></li>
                  {typeChips.map((t) => <li key={t.key}><Link href={href(base, { ...q, type: t.key })} aria-current={q.type === t.key ? "true" : undefined} className={`chip ${q.type === t.key ? "border-primary text-primary" : ""}`}>{t.plural} ({r.typeCounts[t.key]})</Link></li>)}
                </ul>
              </nav>
            )}
            <form method="get" role="search" aria-label={`Search ${title}`} className="mb-6 flex flex-wrap items-end gap-3">
              {q.type && <input type="hidden" name="type" value={q.type} />}
              <div className="min-w-56 flex-1"><label htmlFor="q" className="label">Search</label><input id="q" name="q" defaultValue={q.q} placeholder="Title, deity or keyword" className="input" /></div>
              {r.deities.length > 0 && <div><label htmlFor="deity" className="label">Deity</label>
                <select id="deity" name="deity" defaultValue={q.deity ?? ""} className="input"><option value="">All</option>{r.deities.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>}
              {r.languages.length > 1 && <div><label htmlFor="language" className="label">Language</label>
                <select id="language" name="language" defaultValue={q.language ?? ""} className="input"><option value="">All</option>{DEVOTIONAL_LANGUAGES.filter((l) => r.languages.includes(l.key)).map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}</select></div>}
              <button type="submit" className="btn-outline h-10">Search</button>
              {filtered && <Link href={base} className="btn-ghost h-10">Clear</Link>}
            </form>
          </>
        )}
        {r.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-sandal-300 bg-surface px-6 py-16 text-center">
            <p className="text-lg font-semibold">{total === 0 ? "Coming soon" : "Nothing matches your search"}</p>
            {filtered && total > 0 && <Link href={base} className="btn-outline mt-5">See everything</Link>}
          </div>
        ) : (
          <>
            <p className="sr-only" role="status">{r.total} {r.total === 1 ? "result" : "results"}</p>
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{r.items.map((d) => <DevotionalCardView key={d.id} d={d} />)}</ul>
          </>
        )}
        {r.pages > 1 && (
          <nav aria-label="Pagination" className="mt-10 flex items-center justify-between gap-3 border-t border-sandal-200 pt-6 text-sm">
            {r.page > 1 ? <Link rel="prev" className="btn-outline btn-sm" href={href(base, q, r.page - 1)}>Previous</Link> : <span />}
            <p className="text-muted">Page <span className="font-semibold text-foreground">{r.page}</span> of {r.pages}</p>
            {r.page < r.pages ? <Link rel="next" className="btn-outline btn-sm" href={href(base, q, r.page + 1)}>Next</Link> : <span />}
          </nav>
        )}
      </div>
    </main>
  );
}

async function load(section: Section, params: Promise<{ slug: string }>) {
  const slug = (await params).slug;
  if (!SLUG.test(slug) || slug.length > 80) return null; // never hit the cache or database with junk
  return getPublicDevotional(slug, CFG[section].types);
}

export async function detailMetadata(section: Section, params: Promise<{ slug: string }>): Promise<Metadata> {
  await connection();
  const d = await load(section, params);
  if (!d) return { robots: { index: false } };
  const title = d.seo.title || d.title;
  const description = d.seo.description || d.summary || d.excerpt || undefined;
  const canonical = d.seo.canonical || `${env().SITE_URL.replace(/\/$/, "")}${devotionalHref(d.type, d.slug)}`;
  const image = d.seo.ogImage || d.cover?.url;
  return {
    title, description, alternates: { canonical }, robots: d.seo.noindex ? { index: false, follow: false } : undefined,
    openGraph: { type: "article", title, description, url: canonical, images: image ? [{ url: image }] : undefined, publishedTime: d.publishedAt ?? undefined, modifiedTime: d.updatedAt },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  };
}

export async function DetailContent({ section, params }: { section: Section; params: Promise<{ slug: string }> }) {
  await connection();
  const d = await load(section, params);
  if (!d) notFound();
  const site = env().SITE_URL;
  const s = await getSiteSettings();
  const { base, title } = CFG[section];
  const path = devotionalHref(d.type, d.slug);
  const article = articleLd(site, { type: "Article", title: d.title, slug: d.slug, path, description: d.summary || d.excerpt, image: d.cover?.url ?? "", publishedAt: d.publishedAt, modifiedAt: d.updatedAt, siteName: s.siteName });
  return (
    <>
      <JsonLd data={[
        // AudioObject only while the recording may be played, so structured data never advertises audio that is gone.
        d.audio ? { ...article, audio: { "@type": "AudioObject", name: d.title, contentUrl: d.audio.url, ...(d.audio.durationSeconds ? { duration: `PT${d.audio.durationSeconds}S` } : {}) } } : article,
        breadcrumbLd(site, [{ name: "Home", path: "/" }, { name: title, path: base }, { name: d.title, path }]),
      ]} />
      <DevotionalView d={d} />
    </>
  );
}
