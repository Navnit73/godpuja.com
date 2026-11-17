/* eslint-disable @next/next/no-img-element -- remote CMS images from any host */
import Link from "next/link";
import { responsive } from "@/lib/image";
import { AARTI_BASE, devotionalLangCode, MANTRA_BASE } from "@/lib/validation/devotional";
import { vidhiHref } from "@/lib/validation/vidhi";
import type { PublicDevotional } from "@/server/services/devotional";
import AudioPlayer from "./AudioPlayer";
import DevotionalCardView from "./DevotionalCardView";
import { ArrowRight } from "./Icons";
import PageBand from "./PageBand";
import ProductCard from "./ProductCard";

const DATE = new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" });
const H = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h2 id={id} className="mb-5 font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">{children}</h2>
);
const TAG = "inline-flex min-h-8 items-center rounded-md bg-surface px-3 text-sm font-medium text-foreground ring-1 ring-sandal-300";

/** Reading page for an aarti, mantra, chalisa or stotra (also used for previews). Audio appears only when `d.audio` is set, i.e. rights are valid. */
export default function DevotionalView({ d, preview = false }: { d: PublicDevotional; preview?: boolean }) {
  const isAarti = d.type === "aarti";
  const lang = devotionalLangCode(d.language);
  return (
    <main id="main" tabIndex={-1} className="w-full flex-1">
      {preview && <p role="status" className="bg-saffron-100 px-4 py-2 text-center text-sm font-medium text-saffron-900">Preview: only people with this link can see this page.</p>}
      <PageBand title={d.title} crumbs={[{ name: "Home", href: "/" }, { name: isAarti ? "Aarti" : "Mantras", href: isAarti ? AARTI_BASE : MANTRA_BASE }, { name: d.title }]}>
        <p className="mt-3 flex flex-wrap items-center gap-2">
          <span className="badge-primary min-h-8 px-3 text-sm">{d.typeLabel}</span>
          {d.deity && <span className={TAG}>{d.deity}</span>}
          <span className={TAG}>{d.languageLabel}</span>
        </p>
      </PageBand>
      <article className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        {d.cover && <img {...responsive(d.cover.url, "(min-width: 768px) 768px, 100vw", 768)} alt={d.cover.alt} fetchPriority="high" decoding="async" referrerPolicy="no-referrer" className="mb-10 aspect-[16/9] w-full rounded-lg object-cover" />}
        {d.summary && <p className="text-lg leading-relaxed text-muted sm:text-xl">{d.summary}</p>}
        {d.audio && <div className="mt-8"><AudioPlayer src={d.audio.url} title={d.title} credit={d.audio.credit} durationSeconds={d.audio.durationSeconds} /></div>}

        {d.lyrics && (
          <section aria-labelledby="lyrics" className="mt-12 sm:mt-16">
            <H id="lyrics">{isAarti ? "Lyrics" : "Text"}</H>
            {/* Plain text: line breaks are kept exactly as written. */}
            <div lang={lang} className="whitespace-pre-line rounded-lg bg-sandal-100 p-6 text-xl leading-loose text-foreground sm:p-10 sm:text-2xl">{d.lyrics}</div>
          </section>
        )}
        {d.transliteration && (
          <section aria-labelledby="transliteration" className="mt-12 sm:mt-16">
            <H id="transliteration">In English letters</H>
            <div lang="en" className="whitespace-pre-line rounded-lg border border-sandal-200 p-6 text-lg leading-loose text-foreground sm:p-8">{d.transliteration}</div>
          </section>
        )}
        {d.meaningHtml && <section aria-labelledby="meaning" className="mt-12 sm:mt-16"><H id="meaning">Meaning</H><div className="content" dangerouslySetInnerHTML={{ __html: d.meaningHtml }} /></section>}

        {d.reviewer && d.reviewedAt && <p className="mt-12 rounded-lg bg-success-soft px-4 py-3 text-sm text-success">Reviewed for accuracy by <strong>{d.reviewer}</strong> on {DATE.format(new Date(d.reviewedAt))}</p>}
        {d.tags.length > 0 && <p className="mt-8 flex flex-wrap gap-2 text-xs">{d.tags.map((t) => <span key={t} className="chip">{t}</span>)}</p>}
      </article>

      {(d.related.length > 0 || d.relatedVidhi.length > 0 || d.relatedProducts.length > 0) && (
        <div className="mx-auto w-full max-w-7xl border-t border-sandal-200 px-4 pb-16 sm:px-6">
          {d.relatedVidhi.length > 0 && (
            <section aria-labelledby="related-vidhi" className="mt-12">
              <H id="related-vidhi">Pooja guides</H>
              <ul className="grid gap-3 sm:grid-cols-2">{d.relatedVidhi.map((r) => <li key={r.slug}><Link href={vidhiHref(r.slug)} className="flex items-center justify-between gap-3 rounded-lg bg-sandal-100 px-4 py-3.5 font-medium transition-colors hover:bg-sandal-200">{r.title}<ArrowRight className="h-4 w-4 shrink-0" /></Link></li>)}</ul>
            </section>
          )}
          {d.related.length > 0 && (
            <section aria-labelledby="related-devotional" className="mt-14">
              <H id="related-devotional">More to read and listen to</H>
              <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{d.related.map((r) => <DevotionalCardView key={r.id} d={r} />)}</ul>
            </section>
          )}
          {d.relatedProducts.length > 0 && (
            <section aria-labelledby="related-products" className="mt-14">
              <H id="related-products">From the shop</H>
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">{d.relatedProducts.slice(0, 4).map((p) => <ProductCard key={p.id} p={p} />)}</ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
