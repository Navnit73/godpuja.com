"use client";
import Link from "next/link";
import Script from "next/script";
import { useEffect, useState } from "react";

const KEY = "gp-consent";
type Choice = "granted" | "denied" | null;
const read = (): Choice => { try { const v = localStorage.getItem(KEY); return v === "granted" || v === "denied" ? v : null; } catch { return null; } };

/**
 * Consent-gated Google Analytics 4 (PRD v1.1 §19.2). Nothing is loaded or stored for analytics until the visitor accepts;
 * "Reject" is as easy as "Accept" and the choice can be changed from the footer link ("Cookie settings"). With no
 * measurement ID configured this renders nothing at all.
 */
export default function Analytics({ id }: { id: string }) {
  const [choice, setChoice] = useState<Choice>(null);
  const [ready, setReady] = useState(false);
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    queueMicrotask(() => { const c = read(); setChoice(c); setAsking(c === null); setReady(true); });
    const reopen = () => setAsking(true);
    window.addEventListener("gp:cookie-settings", reopen);
    return () => window.removeEventListener("gp:cookie-settings", reopen);
  }, []);
  const save = (c: "granted" | "denied") => {
    try { localStorage.setItem(KEY, c); } catch { /* private mode: the choice lasts for this page view */ }
    setChoice(c); setAsking(false);
    if (c === "denied") {
      // Withdrawing consent removes the analytics cookies we may have set.
      for (const name of document.cookie.split(";").map((p) => p.split("=")[0].trim()).filter((n) => n === "_ga" || n.startsWith("_ga_"))) document.cookie = `${name}=; Max-Age=0; path=/`;
    }
  };
  if (!ready) return null;
  return (
    <>
      {choice === "granted" && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${id}',{anonymize_ip:true});`}</Script>
        </>
      )}
      {asking && (
        <section role="dialog" aria-labelledby="cookie-title" aria-modal="false" className="fixed inset-x-0 bottom-0 z-50 border-t border-sandal-200 bg-surface p-4 shadow-elev-3 sm:p-5">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-3xl text-sm">
              <h2 id="cookie-title" className="font-sans text-base font-semibold">Cookies</h2>
              <p className="mt-1 text-muted">We use essential cookies to keep you signed in and your cart working. With your permission we also use analytics cookies to learn which pages help devotees. <Link href="/cookies" className="text-primary underline">Cookie policy</Link></p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" className="btn-outline" onClick={() => save("denied")}>Reject analytics</button>
              <button type="button" className="btn-primary" onClick={() => save("granted")}>Accept analytics</button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
