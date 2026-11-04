/* eslint-disable @next/next/no-img-element -- remote CMS images from any host */
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { responsive } from "@/lib/image";
import { VIDHI_BASE } from "@/lib/validation/vidhi";
import type { PublicVidhi } from "@/server/services/vidhi";
import { LotusOrnament } from "./Icons";
import PageBand from "./PageBand";
import ProductCard from "./ProductCard";
import VidhiCardView from "./VidhiCardView";

const DATE = new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" });
const H = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <>
    <h2 id={id} className="section-title">{children}</h2>
    <LotusOrnament className="mb-4 mt-2 h-4 w-16 text-accent" />
  </>
);

/** The reading page for a Pooja Vidhi guide (also used for previews). Shop links sit beside the samagri; related products come after the content. */
export default function VidhiView({ v, preview = false }: { v: PublicVidhi; preview?: boolean }) {
  const hasMantras = v.mantras.length > 0;
  return (
    <main id="main" tabIndex={-1} className="w-full flex-1">
      {preview && <p role="status" className="bg-saffron-100 px-4 py-2 text-center text-sm font-medium text-saffron-900">Preview: only people with this link can see this guide.</p>}
      <PageBand title={v.title} crumbs={[{ name: "Home", href: "/" }, { name: "Pooja Vidhi", href: VIDHI_BASE }, { name: v.title }]}>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-sandal-200">
          <span>{v.categoryLabel}</span>
          {v.deity && <span>{v.deity}</span>}
          {v.durationMinutes && <span>About {v.durationMinutes} min</span>}
        </p>
      </PageBand>
      <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        {v.cover && <img {...responsive(v.cover.url, "(min-width: 768px) 768px, 100vw", 768)} alt={v.cover.alt} fetchPriority="high" decoding="async" referrerPolicy="no-referrer" className="mb-8 aspect-[16/9] w-full rounded-2xl object-cover" />}
        {v.summaryHtml && <div className="content text-lg" dangerouslySetInnerHTML={{ __html: v.summaryHtml }} />}
        {(v.author || v.reviewer) && (
          <p className="mt-4 text-sm text-muted">
            {v.author && <>Written by <strong className="text-foreground">{v.author}</strong></>}
            {v.author && v.reviewer && " · "}
            {v.reviewer && v.reviewedAt && <>Reviewed for accuracy by <strong className="text-foreground">{v.reviewer}</strong> on {DATE.format(new Date(v.reviewedAt))}</>}
          </p>
        )}

        {v.significanceHtml && <section aria-labelledby="significance" className="mt-10"><H id="significance">Significance</H><div className="content" dangerouslySetInnerHTML={{ __html: v.significanceHtml }} /></section>}

        {v.samagri.length > 0 && (
          <section aria-labelledby="samagri" className="mt-10">
            <H id="samagri">Samagri you will need</H>
            <ul className="divide-y divide-sandal-200 overflow-hidden rounded-xl border border-sandal-200 bg-surface">
              {v.samagri.map((s, i) => (
                <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                  <span><span className="font-medium">{s.item}</span>{s.quantity && <span className="text-muted"> — {s.quantity}</span>}{s.note && <span className="block text-xs text-muted">{s.note}</span>}</span>
                  {s.product && s.product.inStock && (
                    <Link href={`/product/${s.product.slug}`} className="shrink-0 text-primary underline">
                      Buy<span className="sr-only"> {s.product.name}</span> · {formatMoney(s.product.salePrice ?? s.product.price)}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {v.preparationHtml && <section aria-labelledby="preparation" className="mt-10"><H id="preparation">Preparation</H><div className="content" dangerouslySetInnerHTML={{ __html: v.preparationHtml }} /></section>}

        {v.steps.length > 0 && (
          <section aria-labelledby="steps" className="mt-10">
            <H id="steps">Steps</H>
            <ol className="space-y-6">
              {v.steps.map((s, i) => (
                <li key={i} className="flex gap-4">
                  <span aria-hidden="true" className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-sans text-lg font-semibold"><span className="sr-only">Step {i + 1}: </span>{s.title || `Step ${i + 1}`}</h3>
                    <div className="content" dangerouslySetInnerHTML={{ __html: s.bodyHtml }} />
                    {s.mantra && <p lang="sa" className="mt-2 whitespace-pre-line rounded-lg border-l-4 border-gold-400 bg-sandal-100 px-4 py-3 text-lg">{s.mantra}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {hasMantras && (
          <section aria-labelledby="mantras" className="mt-10">
            <H id="mantras">Mantras</H>
            <ul className="space-y-5">
              {v.mantras.map((m, i) => (
                <li key={i}>
                  <h3 className="font-sans text-base font-semibold">{m.title}</h3>
                  <p lang="sa" className="mt-1 whitespace-pre-line rounded-lg border-l-4 border-gold-400 bg-sandal-100 px-4 py-3 text-lg">{m.text}</p>
                  {m.meaning && <p className="mt-2 text-sm text-muted"><span className="font-medium text-foreground">Meaning: </span>{m.meaning}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {v.bodyHtml && <section aria-label="More" className="mt-10"><div className="content" dangerouslySetInnerHTML={{ __html: v.bodyHtml }} /></section>}

        {v.tags.length > 0 && <p className="mt-8 flex flex-wrap gap-2 text-xs">{v.tags.map((t) => <span key={t} className="chip">{t}</span>)}</p>}
      </article>

      {(v.relatedProducts.length > 0 || v.relatedVidhi.length > 0) && (
        <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6">
          {v.relatedProducts.length > 0 && (
            <section aria-labelledby="related-products" className="mt-4">
              <H id="related-products">Essentials for this pooja</H>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5">{v.relatedProducts.slice(0, 4).map((p) => <ProductCard key={p.id} p={p} />)}</ul>
            </section>
          )}
          {v.relatedVidhi.length > 0 && (
            <section aria-labelledby="related-guides" className="mt-12">
              <H id="related-guides">More guides</H>
              <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{v.relatedVidhi.map((r) => <VidhiCardView key={r.id} v={r} />)}</ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

