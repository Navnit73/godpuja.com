/* eslint-disable @next/next/no-img-element -- remote CMS images from any host */
import Link from "next/link";
import { responsive } from "@/lib/image";
import { AARTI_BASE, devotionalLangCode, MANTRA_BASE } from "@/lib/validation/devotional";
import { vidhiHref } from "@/lib/validation/vidhi";
import type { PublicDevotional } from "@/server/services/devotional";
import AudioPlayer from "./AudioPlayer";
import DevotionalCardView from "./DevotionalCardView";
import { LotusOrnament } from "./Icons";
import PageBand from "./PageBand";
import ProductCard from "./ProductCard";

const DATE = new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" });
const H = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <>
    <h2 id={id} className="section-title">{children}</h2>
    <LotusOrnament className="mb-4 mt-2 h-4 w-16 text-accent" />
  </>
);

/** Reading page for an aarti, mantra, chalisa or stotra (also used for previews). Audio appears only when `d.audio` is set, i.e. rights are valid. */
export default function DevotionalView({ d, preview = false }: { d: PublicDevotional; preview?: boolean }) {
  const isAarti = d.type === "aarti";
  const lang = devotionalLangCode(d.language);
  return (
    <main id="main" tabIndex={-1} className="w-full flex-1">
      {preview && <p role="status" className="bg-saffron-100 px-4 py-2 text-center text-sm font-medium text-saffron-900">Preview: only people with this link can see this page.</p>}
      <PageBand title={d.title} crumbs={[{ name: "Home", href: "/" }, { name: isAarti ? "Aarti" : "Mantras", href: isAarti ? AARTI_BASE : MANTRA_BASE }, { name: d.title }]}>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-sandal-200">
          <span>{d.typeLabel}</span>{d.deity && <span>{d.deity}</span>}<span>{d.languageLabel}</span>
        </p>
      </PageBand>
      <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        {d.cover && <img {...responsive(d.cover.url, "(min-width: 768px) 768px, 100vw", 768)} alt={d.cover.alt} fetchPriority="high" decoding="async" referrerPolicy="no-referrer" className="mb-8 aspect-[16/9] w-full rounded-2xl object-cover" />}
        {d.summary && <p className="text-lg">{d.summary}</p>}
        {d.audio && <div className="mt-6"><AudioPlayer src={d.audio.url} title={d.title} credit={d.audio.credit} durationSeconds={d.audio.durationSeconds} /></div>}

        {d.lyrics && (
          <section aria-labelledby="lyrics" className="mt-10">
            <H id="lyrics">{isAarti ? "Lyrics" : "Text"}</H>
            {/* Plain text: line breaks are kept exactly as written. */}
            <div lang={lang} className="whitespace-pre-line text-lg leading-loose">{d.lyrics}</div>
          </section>
        )}
        {d.transliteration && (
          <section aria-labelledby="transliteration" className="mt-10">
            <H id="transliteration">In English letters</H>
            <div lang="en" className="whitespace-pre-line leading-loose text-foreground">{d.transliteration}</div>
          </section>
        )}
        {d.meaningHtml && <section aria-labelledby="meaning" className="mt-10"><H id="meaning">Meaning</H><div className="content" dangerouslySetInnerHTML={{ __html: d.meaningHtml }} /></section>}

        {d.reviewer && d.reviewedAt && <p className="mt-8 text-sm text-muted">Reviewed for accuracy by <strong className="text-foreground">{d.reviewer}</strong> on {DATE.format(new Date(d.reviewedAt))}</p>}
        {d.tags.length > 0 && <p className="mt-6 flex flex-wrap gap-2 text-xs">{d.tags.map((t) => <span key={t} className="chip">{t}</span>)}</p>}
      </article>

      {(d.related.length > 0 || d.relatedVidhi.length > 0 || d.relatedProducts.length > 0) && (
        <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6">
          {d.relatedVidhi.length > 0 && (
            <section aria-labelledby="related-vidhi" className="mt-4">
              <H id="related-vidhi">Pooja guides</H>
              <ul className="list-disc space-y-1 pl-5">{d.relatedVidhi.map((r) => <li key={r.slug}><Link href={vidhiHref(r.slug)} className="text-primary underline">{r.title}</Link></li>)}</ul>
            </section>
          )}
          {d.related.length > 0 && (
            <section aria-labelledby="related-devotional" className="mt-12">
              <H id="related-devotional">More to read and listen to</H>
              <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{d.related.map((r) => <DevotionalCardView key={r.id} d={r} />)}</ul>
            </section>
          )}
          {d.relatedProducts.length > 0 && (
            <section aria-labelledby="related-products" className="mt-12">
              <H id="related-products">From the shop</H>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5">{d.relatedProducts.slice(0, 4).map((p) => <ProductCard key={p.id} p={p} />)}</ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
