/* eslint-disable @next/next/no-img-element -- remote CMS images from any host; Cloudinary ones are resized via lib/image */
import Link from "next/link";
import type { PublicHomeSection } from "@/server/services/homepage";
import ProductCard from "./ProductCard";
import { Section as PageSection } from "./PageView";
import { responsive } from "@/lib/image";
import { ArrowRight, LotusOrnament, Mandala, QuoteIcon } from "./Icons";

const external = (u: string) => /^https?:\/\//i.test(u);
function Cta({ href, children, variant = "btn-primary" }: { href: string; children: React.ReactNode; variant?: string }) {
  return external(href)
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={`${variant} gap-2`}>{children}<span className="sr-only"> (opens in a new tab)</span></a>
    : <Link href={href} className={`${variant} gap-2`}>{children}</Link>;
}
const Wrap = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 ${className}`}>{children}</div>;
const Html = ({ html, className = "" }: { html: string; className?: string }) => <div className={`content ${className}`} dangerouslySetInnerHTML={{ __html: html }} />; // sanitised in the service

/** Section heading: serif title, lotus ornament, optional "View all" pill on the right. */
function Heading({ title, href, center }: { title: string; href?: string | null; center?: boolean }) {
  if (!title && !href) return null;
  return (
    <div className={`mb-6 flex gap-3 sm:mb-8 ${center ? "flex-col items-center text-center" : "flex-wrap items-end justify-between"}`}>
      {title && <div className={center ? "flex flex-col items-center" : ""}><h2 className="section-title">{title}</h2><LotusOrnament className="mt-2 h-4 w-16 text-accent" /></div>}
      {href && (
        <Link href={href} className="inline-flex items-center gap-1.5 rounded-full border border-saffron-200 bg-saffron-50 px-4 py-2 text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground">
          View all<span className="sr-only"> {title}</span><ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function Block({ s }: { s: PublicHomeSection }) {
  switch (s.type) {
    case "hero":
      return (
        <Wrap className="pt-4 sm:pt-6">
          <section aria-labelledby={`h-${s.id}`} className="relative isolate overflow-hidden rounded-3xl bg-sacred text-white shadow-elev-2">
            <div className="pattern-rangoli absolute inset-0 -z-10" aria-hidden="true" />
            <Mandala className="absolute -right-24 -top-24 -z-10 h-96 w-96 text-gold-300 opacity-25 md:-right-16 md:h-128 md:w-128" />
            <Mandala className="absolute -bottom-32 -left-28 -z-10 h-80 w-80 text-gold-300 opacity-15" />
            <div className={`grid items-center gap-8 px-6 py-10 sm:px-10 md:py-14 lg:px-14 ${s.imageUrl ? "md:grid-cols-2" : "text-center"}`}>
              <div className={s.imageUrl ? "" : "mx-auto max-w-2xl"}>
                <LotusOrnament className={`mb-4 h-4 w-20 text-gold-300 ${s.imageUrl ? "" : "mx-auto"}`} />
                <h1 id={`h-${s.id}`} className="text-4xl font-semibold text-white sm:text-5xl lg:text-6xl">{s.heading}</h1>
                {s.subheading && <p className="mt-4 text-lg text-sandal-100">{s.subheading}</p>}
                <div className={`mt-8 flex flex-wrap gap-3 ${s.imageUrl ? "" : "justify-center"}`}>
                  {s.ctaLabel && <Cta href={s.ctaUrl} variant="btn-light">{s.ctaLabel}<ArrowRight /></Cta>}
                  {s.secondaryCtaLabel && <Cta href={s.secondaryCtaUrl} variant="btn-ghost-light">{s.secondaryCtaLabel}</Cta>}
                </div>
              </div>
              {s.imageUrl && (
                <div className="relative">
                  <div className="absolute -inset-3 rounded-3xl border border-gold-300 opacity-40" aria-hidden="true" />
                  <img {...responsive(s.imageUrl, "(min-width: 768px) 50vw, 100vw", 640)} alt={s.imageAlt} fetchPriority="high" referrerPolicy="no-referrer" className="relative aspect-4/3 w-full rounded-2xl object-cover shadow-elev-4" />
                </div>
              )}
            </div>
          </section>
        </Wrap>
      );
    case "banner": {
      const n = s.items.length;
      return (
        <Wrap className="py-8 sm:py-10"><ul className={`grid gap-4 sm:gap-5 ${n === 2 ? "sm:grid-cols-2" : n >= 3 ? "md:grid-cols-2" : ""}`}>
          {s.items.map((b, i) => {
            const tall = n === 3 && i === 0;
            const inner = (
              <>
                <img {...responsive(b.imageUrl, "(min-width: 640px) 50vw, 100vw", 640)} alt={b.imageAlt} loading="lazy" decoding="async" referrerPolicy="no-referrer"
                  className={`w-full object-cover transition-transform duration-500 ease-standard group-hover:scale-105 ${tall ? "aspect-16/7 md:absolute md:inset-0 md:aspect-auto md:h-full" : "aspect-16/7"}`} />
                {(b.heading || b.text) && (
                  <div className="absolute inset-0 flex flex-col justify-end bg-linear-to-t from-kumkum-950 via-kumkum-950/40 to-transparent p-5 text-white sm:p-6">
                    {b.heading && <p className="font-serif text-2xl font-semibold sm:text-3xl">{b.heading}</p>}
                    {b.text && <p className="mt-1 max-w-md text-sm text-sandal-100">{b.text}</p>}
                    {b.linkUrl && <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-surface px-4 py-1.5 text-xs font-semibold text-kumkum-900" aria-hidden="true">Explore <ArrowRight className="h-3.5 w-3.5" /></span>}
                  </div>
                )}
              </>
            );
            const cls = "group relative block h-full";
            return (
              <li key={i} className={`relative overflow-hidden rounded-2xl bg-sandal-100 shadow-elev-1 ${tall ? "md:row-span-2" : ""}`}>
                {b.linkUrl ? (external(b.linkUrl) ? <a href={b.linkUrl} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a> : <Link href={b.linkUrl} className={cls}>{inner}</Link>) : <div className={cls}>{inner}</div>}
              </li>
            );
          })}
        </ul></Wrap>
      );
    }
    case "featuredCategories":
      return (
        <Wrap className="py-10 sm:py-12">
          <Heading title={s.heading} />
          <ul className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-6 lg:grid-cols-6">
            {s.categories.map((c) => (
              <li key={c.id}>
                <Link href={`/category/${c.path}`} className="group flex flex-col items-center gap-3 text-center">
                  <span className="block w-full max-w-36 rounded-full bg-dawn p-1.5 ring-1 ring-sandal-200 transition-all duration-200 ease-standard group-hover:-translate-y-1 group-hover:shadow-elev-3 group-hover:ring-2 group-hover:ring-gold-400">
                    {c.image.url
                      ? <img {...responsive(c.image.url, "(min-width: 1024px) 160px, 33vw", 320)} alt={c.image.alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="aspect-square w-full rounded-full object-cover" />
                      : <span className="flex aspect-square w-full items-center justify-center rounded-full bg-saffron-50 font-serif text-4xl font-semibold text-primary" aria-hidden="true">{c.name.charAt(0)}</span>}
                  </span>
                  <span className="text-sm font-medium text-foreground group-hover:text-primary sm:text-base">{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Wrap>
      );
    case "featuredProducts": case "latestProducts": case "bestSellers":
      return (
        <section className={s.type === "latestProducts" ? "bg-dawn" : ""}>
          <Wrap className="py-10 sm:py-14">
            <Heading title={s.heading} href={s.viewAll} />
            <ul aria-label={s.heading || "Products"} className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">{s.products.map((p) => <ProductCard key={p.id} p={p} />)}</ul>
          </Wrap>
        </section>
      );
    case "richText":
      return <Wrap className="max-w-4xl py-10"><Html html={s.html} /></Wrap>;
    case "imageText":
      return <Wrap className="max-w-6xl py-10 sm:py-14"><PageSection s={s} /></Wrap>;
    case "testimonials":
      return (
        <section className="bg-dawn"><Wrap className="py-12 sm:py-16">
          <Heading title={s.heading} center />
          <ul className="grid gap-5 md:grid-cols-3">
            {s.items.map((t, i) => (
              <li key={i} className="relative rounded-2xl border border-sandal-200 bg-surface p-6 shadow-elev-1">
                <QuoteIcon className="h-8 w-8 text-gold-300" />
                <figure className="mt-3">
                  <blockquote className="text-base leading-relaxed text-foreground">{t.quote}</blockquote>
                  <figcaption className="mt-5 flex items-center gap-3 border-t border-sandal-200 pt-4 text-sm">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sacred font-serif text-lg font-semibold text-white" aria-hidden="true">{t.author.charAt(0)}</span>
                    <span><span className="block font-semibold">{t.author}</span>{t.role && <span className="text-muted">{t.role}</span>}</span>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </Wrap></section>
      );
    case "offer":
      return (
        <Wrap className="py-8 sm:py-10">
          <section aria-label="Offer" className="relative isolate overflow-hidden rounded-3xl bg-dusk text-white shadow-elev-2">
            <div className="pattern-rangoli absolute inset-0 -z-10" aria-hidden="true" />
            <Mandala className="absolute -right-16 top-1/2 -z-10 h-80 w-80 -translate-y-1/2 text-gold-300 opacity-20" />
            <div className="flex flex-col items-start justify-between gap-6 px-6 py-8 sm:px-10 md:flex-row md:items-center">
              <div>
                <p className="font-serif text-3xl font-semibold sm:text-4xl">{s.heading}</p>
                {s.text && <p className="mt-2 max-w-xl text-sandal-100">{s.text}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {s.code && <p className="rounded-full border-2 border-dashed border-gold-300 px-4 py-2 font-mono text-sm font-semibold tracking-widest text-gold-100"><span className="sr-only">Use code </span>{s.code}</p>}
                {s.ctaLabel && <Cta href={s.ctaUrl} variant="btn-light">{s.ctaLabel}<ArrowRight /></Cta>}
              </div>
            </div>
          </section>
        </Wrap>
      );
    case "custom": {
      const tone = s.tone === "soft" ? "bg-sandal-100" : s.tone === "accent" ? "bg-dawn" : "";
      return <section className={tone}><Wrap className="max-w-4xl py-10 sm:py-14"><Html html={s.html} /></Wrap></section>;
    }
  }
}

export default function HomeView({ sections }: { sections: PublicHomeSection[] }) {
  const hasHero = sections.some((s) => s.type === "hero");
  return (
    <main id="main" tabIndex={-1} className="flex-1 pb-6">
      {!hasHero && <h1 className="sr-only">GodPuja</h1>}
      {sections.map((s) => <Block key={s.id} s={s} />)}
    </main>
  );
}
