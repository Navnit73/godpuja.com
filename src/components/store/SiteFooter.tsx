import Link from "next/link";
import { connection } from "next/server";
import Logo from "@/components/Logo";
import { getPublicFooter } from "@/server/public/footer";
import type { PublicFooter, PublicLink } from "@/server/services/footer";
import { GiftIcon, HeadsetIcon, Mandala, MailIcon, PhoneIcon, PinIcon, ShieldIcon, TruckIcon } from "./Icons";
import NewsletterForm from "./NewsletterForm";

const PLATFORM: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", x: "X", youtube: "YouTube", whatsapp: "WhatsApp", linkedin: "LinkedIn", telegram: "Telegram" };

function FooterLink({ l, className = "" }: { l: PublicLink; className?: string }) {
  const cls = `transition-colors hover:text-gold-300 ${className}`;
  return l.external || l.newTab
    ? <a href={l.href} className={cls} {...(l.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{l.label}{l.newTab && <span className="sr-only"> (opens in a new tab)</span>}</a>
    : <Link href={l.href} className={cls}>{l.label}</Link>;
}

const PROMISES = [
  { Icon: ShieldIcon, title: "Secure payments", text: "Encrypted, trusted checkout" },
  { Icon: GiftIcon, title: "Pure & authentic", text: "Quality-checked puja samagri" },
  { Icon: TruckIcon, title: "Delivered with care", text: "Packed safely for every ritual" },
  { Icon: HeadsetIcon, title: "Devotee support", text: "We are happy to help" },
];

function Promises() {
  return (
    <div className="border-t border-sandal-200 bg-sandal-100">
      <ul className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-x-4 gap-y-6 px-4 py-8 sm:px-6 lg:grid-cols-4">
        {PROMISES.map(({ Icon, title, text }) => (
          <li key={title} className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface text-primary ring-1 ring-saffron-200"><Icon className="h-6 w-6" /></span>
            <span><span className="block text-sm font-semibold text-foreground sm:text-base">{title}</span><span className="block text-xs text-muted sm:text-sm">{text}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FooterShell() {
  return <footer className="mt-auto bg-kumkum-950" aria-hidden="true"><div className="h-64" /></footer>;
}

export default async function SiteFooter() {
  await connection(); // request-time read; the build never needs the database
  // Chrome must never take the page down: if the read fails, render without a footer (logged for ops).
  const f = await getPublicFooter().catch((e) => { console.error("[footer] read failed", e); return null; });
  if (!f) return <footer className="mt-auto"><Promises /></footer>;
  return <FooterView f={f} />;
}

export function FooterView({ f }: { f: PublicFooter }) {
  const { contact } = f;
  const hasContact = !!(contact.address || contact.phone || contact.email);
  return (
    <footer className="mt-auto text-sm">
      <Promises />
      <div className="relative isolate overflow-hidden bg-dusk text-sandal-200">
        <div className="pattern-rangoli absolute inset-0 -z-10 opacity-60" aria-hidden="true" />
        <Mandala className="absolute -bottom-40 -right-40 -z-10 h-120 w-120 text-gold-300 opacity-10" />
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-4">
            <Link href="/" aria-label="GodPuja home" className="inline-block"><Logo tone="light" /></Link>
            {hasContact && (
              <address className="space-y-2.5 not-italic">
                {contact.address && <p className="flex gap-2.5"><PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" /><span className="whitespace-pre-line">{contact.address}</span></p>}
                {contact.phone && <p className="flex gap-2.5"><PhoneIcon className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" /><a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="hover:text-gold-300">{contact.phone}</a></p>}
                {contact.email && <p className="flex gap-2.5"><MailIcon className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" /><a href={`mailto:${contact.email}`} className="break-all hover:text-gold-300">{contact.email}</a></p>}
              </address>
            )}
            {f.social.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Social media">
                {f.social.map((s) => (
                  <li key={s.id}><a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center rounded-full border border-white/20 px-3.5 text-xs font-medium transition-colors hover:border-gold-300 hover:text-gold-300">{PLATFORM[s.platform] ?? s.platform}<span className="sr-only"> (opens in a new tab)</span></a></li>
                ))}
              </ul>
            )}
          </div>
          {f.columns.map((c) => (
            <nav key={c.id} aria-labelledby={`footer-${c.id}`} className="lg:col-span-2">
              <h2 id={`footer-${c.id}`} className="mb-4 font-sans text-sm font-semibold uppercase tracking-widest text-gold-300">{c.heading}</h2>
              <ul className="space-y-2.5">{c.links.map((l) => <li key={l.id}><FooterLink l={l} /></li>)}</ul>
            </nav>
          ))}
          {f.newsletter.enabled && (
            <div className="grid items-center gap-4 rounded-2xl bg-surface p-5 text-foreground sm:p-6 md:col-span-2 lg:col-span-12 lg:grid-cols-2 lg:gap-10">
              <div>
                <h2 className="font-serif text-2xl font-semibold">{f.newsletter.heading || "Newsletter"}</h2>
                {f.newsletter.text && <p className="mt-1 text-muted">{f.newsletter.text}</p>}
              </div>
              <NewsletterForm />
            </div>
          )}
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-sandal-300 sm:px-6">
            <p>{f.copyright}</p>
            {f.legalLinks.length > 0 && (
              <nav aria-label="Legal"><ul className="flex flex-wrap gap-x-5 gap-y-1">{f.legalLinks.map((l) => <li key={l.id}><FooterLink l={l} /></li>)}</ul></nav>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
