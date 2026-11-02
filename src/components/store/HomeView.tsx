/* eslint-disable @next/next/no-img-element -- remote CMS images from any host; Cloudinary ones are resized via lib/image */
import Link from "next/link";
import type { PublicHomeSection } from "@/server/services/homepage";
import ProductCard from "./ProductCard";
import { Section as PageSection } from "./PageView";
import { responsive } from "@/lib/image";

const external = (u: string) => /^https?:\/\//i.test(u);
function Cta({ href, children, variant = "btn-primary" }: { href: string; children: React.ReactNode; variant?: string }) {
  return external(href)
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={variant}>{children}<span className="sr-only"> (opens in a new tab)</span></a>
    : <Link href={href} className={variant}>{children}</Link>;
}
const Wrap = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 ${className}`}>{children}</div>;
const Html = ({ html, className = "" }: { html: string; className?: string }) => <div className={`content ${className}`} dangerouslySetInnerHTML={{ __html: html }} />; // sanitised in the service

function Block({ s }: { s: PublicHomeSection }) {
  switch (s.type) {
    case "hero":
      return (
        <section aria-labelledby={`h-${s.id}`} className="bg-sandal-100">
          <Wrap className={`grid items-center gap-8 py-12 md:py-16 ${s.imageUrl ? "md:grid-cols-2" : "text-center"}`}>
            <div className={s.imageUrl ? "" : "mx-auto max-w-2xl"}>
              <h1 id={`h-${s.id}`} className="text-4xl font-semibold sm:text-5xl">{s.heading}</h1>
              {s.subheading && <p className="mt-4 text-lg text-muted">{s.subheading}</p>}
              <div className={`mt-6 flex flex-wrap gap-3 ${s.imageUrl ? "" : "justify-center"}`}>
                {s.ctaLabel && <Cta href={s.ctaUrl}>{s.ctaLabel}</Cta>}
                {s.secondaryCtaLabel && <Cta href={s.secondaryCtaUrl} variant="btn-outline">{s.secondaryCtaLabel}</Cta>}
              </div>
            </div>
            {s.imageUrl && <img {...responsive(s.imageUrl, "(min-width: 768px) 50vw, 100vw", 640)} alt={s.imageAlt} fetchPriority="high" referrerPolicy="no-referrer" className="h-auto w-full rounded-xl" />}
          </Wrap>
        </section>
      );
    case "banner":
      return (
        <Wrap className="py-8"><ul className={`grid gap-4 ${s.items.length > 1 ? "sm:grid-cols-2" : ""}`}>
          {s.items.map((b, i) => {
            const inner = (
              <>
                <img {...responsive(b.imageUrl, "(min-width: 640px) 50vw, 100vw", 640)} alt={b.imageAlt} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="aspect-[16/7] w-full object-cover" />
                {(b.heading || b.text) && <div className="p-4">{b.heading && <p className="text-lg font-semibold">{b.heading}</p>}{b.text && <p className="text-sm text-muted">{b.text}</p>}</div>}
              </>
            );
            return <li key={i} className="card overflow-hidden p-0">{b.linkUrl ? (external(b.linkUrl) ? <a href={b.linkUrl} target="_blank" rel="noopener noreferrer">{inner}</a> : <Link href={b.linkUrl}>{inner}</Link>) : inner}</li>;
          })}
        </ul></Wrap>
      );
    case "featuredCategories":
      return (
        <Wrap className="py-10">
          {s.heading && <h2 className="mb-6 text-3xl font-semibold">{s.heading}</h2>}
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {s.categories.map((c) => (
              <li key={c.id} className="card overflow-hidden p-0">
                <Link href={`/category/${c.path}`} className="group block">
                  {c.image.url ? <img {...responsive(c.image.url, "(min-width: 768px) 25vw, 50vw", 320)} alt={c.image.alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="aspect-square w-full object-cover" /> : <div className="aspect-square w-full bg-sandal-100" aria-hidden="true" />}
                  <p className="p-3 font-medium group-hover:text-primary">{c.name}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Wrap>
      );
    case "featuredProducts": case "latestProducts": case "bestSellers":
      return (
        <Wrap className="py-10">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
            {s.heading && <h2 className="text-3xl font-semibold">{s.heading}</h2>}
            {s.viewAll && <Link href={s.viewAll} className="text-sm font-medium text-primary underline">View all<span className="sr-only"> {s.heading}</span></Link>}
          </div>
          <ul aria-label={s.heading || "Products"} className="grid grid-cols-2 gap-4 md:grid-cols-4">{s.products.map((p) => <ProductCard key={p.id} p={p} />)}</ul>
        </Wrap>
      );
    case "richText":
      return <Wrap className="max-w-4xl py-10"><Html html={s.html} /></Wrap>;
    case "imageText":
      return <Wrap className="max-w-5xl py-10"><PageSection s={s} /></Wrap>;
    case "testimonials":
      return (
        <section className="bg-sandal-100"><Wrap className="py-12">
          {s.heading && <h2 className="mb-6 text-3xl font-semibold">{s.heading}</h2>}
          <ul className="grid gap-4 md:grid-cols-3">
            {s.items.map((t, i) => (
              <li key={i} className="card p-5"><figure><blockquote className="text-base">“{t.quote}”</blockquote><figcaption className="mt-3 text-sm"><span className="font-semibold">{t.author}</span>{t.role && <span className="text-muted"> · {t.role}</span>}</figcaption></figure></li>
            ))}
          </ul>
        </Wrap></section>
      );
    case "offer":
      return (
        <section aria-label="Offer" className="bg-saffron-700 text-primary-foreground"><Wrap className="flex flex-wrap items-center justify-between gap-4 py-6">
          <div><p className="text-xl font-semibold">{s.heading}</p>{s.text && <p className="text-sm opacity-90">{s.text}</p>}</div>
          <div className="flex items-center gap-3">
            {s.code && <p className="rounded-md border border-dashed border-current px-3 py-1.5 font-mono text-sm"><span className="sr-only">Use code </span>{s.code}</p>}
            {s.ctaLabel && <Cta href={s.ctaUrl} variant="btn bg-surface text-foreground hover:bg-sandal-100">{s.ctaLabel}</Cta>}
          </div>
        </Wrap></section>
      );
    case "custom": {
      const tone = s.tone === "soft" ? "bg-sandal-100" : s.tone === "accent" ? "bg-saffron-50" : "";
      return <section className={tone}><Wrap className="max-w-4xl py-10"><Html html={s.html} /></Wrap></section>;
    }
  }
}

export default function HomeView({ sections }: { sections: PublicHomeSection[] }) {
  const hasHero = sections.some((s) => s.type === "hero");
  return (
    <main id="main" tabIndex={-1} className="flex-1">
      {!hasHero && <h1 className="sr-only">GodPuja</h1>}
      {sections.map((s) => <Block key={s.id} s={s} />)}
    </main>
  );
}
