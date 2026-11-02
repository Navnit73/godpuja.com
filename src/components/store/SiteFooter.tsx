import Link from "next/link";
import { connection } from "next/server";
import Logo from "@/components/Logo";
import { getPublicFooter } from "@/server/public/footer";
import type { PublicLink } from "@/server/services/footer";
import NewsletterForm from "./NewsletterForm";

const PLATFORM: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", x: "X", youtube: "YouTube", whatsapp: "WhatsApp", linkedin: "LinkedIn", telegram: "Telegram" };

function FooterLink({ l, className = "" }: { l: PublicLink; className?: string }) {
  const cls = `hover:text-primary ${className}`;
  return l.external || l.newTab
    ? <a href={l.href} className={cls} {...(l.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{l.label}{l.newTab && <span className="sr-only"> (opens in a new tab)</span>}</a>
    : <Link href={l.href} className={cls}>{l.label}</Link>;
}

export function FooterShell() {
  return <footer className="mt-auto border-t border-border bg-sandal-100" aria-hidden="true"><div className="h-64" /></footer>;
}

export default async function SiteFooter() {
  await connection(); // request-time read; the build never needs the database
  // Chrome must never take the page down: if the read fails, render without a footer (logged for ops).
  const f = await getPublicFooter().catch((e) => { console.error("[footer] read failed", e); return null; });
  if (!f) return null;
  const { contact } = f;
  const hasContact = !!(contact.address || contact.phone || contact.email);
  return (
    <footer className="mt-auto border-t border-border bg-sandal-100 text-sm">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <Link href="/" aria-label="GodPuja home"><Logo /></Link>
          {hasContact && (
            <address className="space-y-1 not-italic text-muted">
              {contact.address && <p className="whitespace-pre-line">{contact.address}</p>}
              {contact.phone && <p><a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="hover:text-primary">{contact.phone}</a></p>}
              {contact.email && <p><a href={`mailto:${contact.email}`} className="hover:text-primary">{contact.email}</a></p>}
            </address>
          )}
          {f.social.length > 0 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Social media">
              {f.social.map((s) => (
                <li key={s.id}><a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-primary">{PLATFORM[s.platform] ?? s.platform}<span className="sr-only"> (opens in a new tab)</span></a></li>
              ))}
            </ul>
          )}
        </div>
        {f.columns.map((c) => (
          <nav key={c.id} aria-labelledby={`footer-${c.id}`}>
            <h2 id={`footer-${c.id}`} className="mb-3 font-sans text-sm font-semibold uppercase tracking-wide">{c.heading}</h2>
            <ul className="space-y-2">{c.links.map((l) => <li key={l.id}><FooterLink l={l} className="text-muted" /></li>)}</ul>
          </nav>
        ))}
        {f.newsletter.enabled && (
          <div>
            <h2 className="mb-1 font-sans text-sm font-semibold uppercase tracking-wide">{f.newsletter.heading || "Newsletter"}</h2>
            {f.newsletter.text && <p className="mb-3 text-muted">{f.newsletter.text}</p>}
            <NewsletterForm />
          </div>
        )}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-muted sm:px-6">
          <p>{f.copyright}</p>
          {f.legalLinks.length > 0 && (
            <nav aria-label="Legal"><ul className="flex flex-wrap gap-x-4">{f.legalLinks.map((l) => <li key={l.id}><FooterLink l={l} /></li>)}</ul></nav>
          )}
        </div>
      </div>
    </footer>
  );
}
