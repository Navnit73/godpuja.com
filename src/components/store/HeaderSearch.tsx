"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { formatMoney } from "@/lib/money";
import { devotionalHref } from "@/lib/validation/devotional";
import { vidhiHref } from "@/lib/validation/vidhi";
import type { Suggestions } from "@/server/services/search";
import { SearchIcon } from "./Icons";

const RECENT_KEY = "gp-recent-searches";
const POPULAR = ["Ganesh idol", "Diwali kit", "Rudraksha", "Hanuman Chalisa", "Havan", "Brass diya"];
const readRecent = (): string[] => { try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 5) : []; } catch { return []; } };
const writeRecent = (list: string[]) => { try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* storage blocked: recent searches just are not remembered */ } };

type Row = { id: string; href: string; label: string; meta?: string; image?: string | null; group: string };

/** Escapes the typed text and wraps matches in <mark> (as React nodes, never as HTML). */
function Highlight({ text, q }: { text: string; q: string }) {
  const words = q.split(/\s+/).filter((w) => w.length >= 2).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${words.join("|")})`, "ig"));
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i} className="rounded-sm bg-saffron-100 px-0.5 text-inherit">{p}</mark> : <span key={i}>{p}</span>))}</>;
}

/**
 * Header search with type-ahead (a combobox): products with price and photo, categories, Pooja Vidhi, aarti and mantras, blog and guides.
 * It is a plain GET form first, so it works without JavaScript. Arrow keys move through suggestions, Enter opens one (or searches),
 * Escape closes. With an empty box it offers recent searches and popular terms.
 */
export default function HeaderSearch({ className = "", id = "header-q", inline = false }: { className?: string; id?: string; inline?: boolean }) {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Suggestions | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const box = useRef<HTMLFormElement>(null);
  const term = q.replace(/\s+/g, " ").trim();

  // Fetch suggestions 180 ms after typing stops; a newer keystroke cancels the older request.
  useEffect(() => {
    if (term.length < 2) { queueMicrotask(() => { setData(null); setLoading(false); setFailed(false); }); return; }
    const ctl = new AbortController();
    queueMicrotask(() => setLoading(true));
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, { signal: ctl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { data: Suggestions };
        setData(json.data); setFailed(false); setActive(-1);
      } catch (e) { if ((e as Error).name !== "AbortError") { setFailed(true); setData(null); } }
      finally { if (!ctl.signal.aborted) setLoading(false); }
    }, 180);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [term]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const searchHref = (s: string) => `/search?q=${encodeURIComponent(s)}`;
  const rows: Row[] = useMemo(() => {
    if (term.length < 2) return [];
    const r: Row[] = [];
    for (const p of data?.products ?? []) r.push({ id: `p-${p.id}`, group: "Products", href: `/product/${p.slug}`, label: p.name, image: p.image?.url, meta: `${formatMoney(p.salePrice ?? p.price)}${p.inStock ? "" : " · Out of stock"}` });
    for (const c of data?.categories ?? []) r.push({ id: `c-${c.path}`, group: "Categories", href: `/shop/${c.path}`, label: c.name, meta: "Category" });
    for (const v of data?.vidhi ?? []) r.push({ id: `v-${v.slug}`, group: "Pooja Vidhi", href: vidhiHref(v.slug), label: v.title, meta: v.categoryLabel });
    for (const d of data?.devotionals ?? []) r.push({ id: `d-${d.slug}`, group: "Aarti & Mantras", href: devotionalHref(d.type, d.slug), label: d.title, meta: `${d.typeLabel}${d.deity ? ` · ${d.deity}` : ""}${d.hasAudio ? " · Audio" : ""}` });
    for (const p of data?.posts ?? []) r.push({ id: `b-${p.slug}`, group: p.kind === "guide" ? "Guides" : "Blog", href: `/${p.slug}`, label: p.title });
    r.push({ id: "all", group: "", href: searchHref(term), label: `See all results for “${term}”` });
    return r;
  }, [data, term]);

  const remember = (s: string) => { const t = s.trim(); if (t.length < 2) return; const next = [t, ...readRecent().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 5); writeRecent(next); setRecent(next); };
  const go = (href: string, saveAs?: string) => { if (saveAs) remember(saveAs); setOpen(false); router.push(href); };
  const groups = useMemo(() => {
    const out: { name: string; rows: { r: Row; i: number }[] }[] = [];
    rows.forEach((r, i) => { const last = out[out.length - 1]; if (last && last.name === r.group) last.rows.push({ r, i }); else out.push({ name: r.group, rows: [{ r, i }] }); });
    return out;
  }, [rows]);
  const showIdle = open && term.length < 2;
  const showResults = open && term.length >= 2;
  const optId = (i: number) => `${listId}-o${i}`;

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { setOpen(false); return; }
    if (!showResults || rows.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % rows.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a <= 0 ? rows.length - 1 : a - 1)); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); go(rows[active].href, term); }
  }

  return (
    <form ref={box} method="get" action="/search" role="search" aria-label="Site search" className={`relative ${className}`}
      onSubmit={(e) => { if (term.length >= 2) { e.preventDefault(); go(searchHref(term), term); } }}>
      <label htmlFor={id} className="sr-only">Search products, guides, aarti and mantras</label>
      <input id={id} name="q" type="search" maxLength={100} autoComplete="off" placeholder="Search shop, aarti, guides…" value={q}
        role="combobox" aria-expanded={showResults && !!data && data.total > 0} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={showResults && active >= 0 ? optId(active) : undefined}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => { setRecent(readRecent()); setOpen(true); }} onKeyDown={onKeyDown}
        className="input h-11 rounded-full border-sandal-300 bg-sandal-50 pl-5 pr-14 focus:bg-surface" />
      <button type="submit" className="absolute right-1 top-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-saffron-800">
        <SearchIcon className="h-4 w-4" /><span className="sr-only">Search</span>
      </button>

      {/* Panel: a plain container. Only the result groups are the ARIA listbox, so it owns nothing but groups of options. */}
      <div hidden={!(showResults || showIdle)}
        className={`${inline ? "relative mt-2" : "absolute inset-x-0 top-full z-50 mt-2 max-h-[min(32rem,calc(100dvh-8rem))] overflow-y-auto shadow-elev-4 md:min-w-[26rem]"} rounded-2xl border border-sandal-200 bg-surface p-2`}>
        {showIdle && (
          <div className="space-y-3 p-2 text-sm">
            {recent.length > 0 && (
              <div>
                <div className="mb-1 flex items-center justify-between"><p className="font-semibold">Recent searches</p>
                  <button type="button" className="text-xs text-muted underline" onClick={() => { writeRecent([]); setRecent([]); }}>Clear</button></div>
                <ul className="flex flex-wrap gap-2">{recent.map((r) => <li key={r}><button type="button" className="chip" onClick={() => go(searchHref(r), r)}>{r}</button></li>)}</ul>
              </div>
            )}
            <div>
              <p className="mb-1 font-semibold">Popular</p>
              <ul className="flex flex-wrap gap-2">{POPULAR.map((r) => <li key={r}><button type="button" className="chip" onClick={() => go(searchHref(r), r)}>{r}</button></li>)}</ul>
            </div>
            <p className="text-xs text-muted">Search shop products, Pooja Vidhi guides, aarti, mantras and the blog.</p>
          </div>
        )}
        {showResults && (
          <>
            <p className="sr-only" role="status">{loading ? "Searching…" : failed ? "Suggestions are unavailable" : `${data?.total ?? 0} suggestions`}</p>
            {failed && <p className="p-3 text-sm text-muted">Suggestions are unavailable right now. Press Enter to search.</p>}
            {!failed && !loading && data && data.total === 0 && <p className="p-3 text-sm text-muted">No quick matches for “{term}”. Press Enter to search everything, including partial words.</p>}
            {!failed && loading && !data && <p className="p-3 text-sm text-muted">Searching…</p>}
            {!failed && data && data.total > 0 && (
              <div id={listId} role="listbox" aria-label="Search suggestions">
                {groups.map((g) => (
                  <div key={g.name || "all"} role="group" aria-label={g.name || "All results"} className={g.name ? "" : "mt-1 border-t border-sandal-200 pt-1"}>
                    {g.name && <p aria-hidden="true" className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-muted">{g.name}</p>}
                    {g.rows.map(({ r, i }) => (
                      <Link key={r.id} id={optId(i)} role="option" aria-selected={i === active} href={r.href} tabIndex={-1} onClick={() => { remember(term); setOpen(false); }} onMouseEnter={() => setActive(i)}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${i === active ? "bg-saffron-50 text-primary" : ""} ${r.id === "all" ? "font-medium text-primary" : ""}`}>
                        {r.group === "Products" && (r.image
                          ? <Image src={r.image} alt="" width={40} height={40} unoptimized className="h-10 w-10 shrink-0 rounded-md object-cover" />
                          : <span className="h-10 w-10 shrink-0 rounded-md bg-sandal-100" aria-hidden="true" />)}
                        <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.id === "all" ? r.label : <Highlight text={r.label} q={term} />}</span>
                          {r.meta && <span className="block truncate text-xs text-muted">{r.meta}</span>}</span>
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </form>
  );
}
