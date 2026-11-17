"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { PublicMenuItem } from "@/server/services/menus";
import HeaderSearch from "./HeaderSearch";
import { ChevronDown, CloseIcon, MenuIcon } from "./Icons";

function NavLink({ item, className, onNavigate }: { item: PublicMenuItem; className: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  if (item.external || item.newTab) {
    return (
      <a href={item.href} className={className} onClick={onNavigate}
        {...(item.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {item.label}{item.newTab && <span className="sr-only"> (opens in a new tab)</span>}
      </a>
    );
  }
  return (
    <Link href={item.href} className={className} onClick={onNavigate} aria-current={pathname === item.href ? "page" : undefined}>
      {item.label}
    </Link>
  );
}

const pill = "flex items-center rounded-md transition-colors hover:bg-saffron-50 has-[[aria-current=page]]:bg-saffron-50 has-[[aria-current=page]]:text-primary has-[[aria-expanded=true]]:bg-saffron-50";
const pillLink = "block rounded-md px-4 py-2 text-sm font-medium text-foreground transition-colors hover:text-primary aria-[current=page]:text-primary";
const subLinkCls = "rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-saffron-50 hover:text-primary aria-[current=page]:text-primary";

function DesktopItem({ item }: { item: PublicMenuItem }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const toggleBtn = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const pathname = usePathname();
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) { setSeenPath(pathname); setOpen(false); } // close after navigating
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const wide = item.children.some((c) => c.children.length > 0); // categories with sub-categories get a multi-column panel

  if (!item.children.length) return <li className={pill}><NavLink item={item} className={pillLink} /></li>;
  return (
    <li ref={ref} className="relative"
      // Mouse users get the menu on hover; touch and keyboard users use the arrow button (click / Enter).
      onPointerEnter={(e) => { if (e.pointerType === "mouse") { clearTimeout(timer.current); setOpen(true); } }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 150); } }}
      onKeyDown={(e) => { if (e.key === "Escape" && open) { setOpen(false); toggleBtn.current?.focus(); } }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}>
      <div className={pill}>
        <NavLink item={item} className={`${pillLink} pr-1.5`} />
        <button ref={toggleBtn} type="button" className="mr-1.5 rounded-md p-1.5 text-muted transition-colors hover:text-primary" aria-expanded={open} aria-controls={panelId}
          aria-label={`${item.label} submenu`} onClick={() => setOpen((o) => !o)}>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && (
        // The wrapper's top padding (not a margin) keeps the pointer inside the item while it moves from the label to the panel.
        <div className="absolute left-0 top-full z-40 pt-2">
          <ul id={panelId} className={wide
            ? "grid max-h-[calc(100dvh-9rem)] w-[min(52rem,calc(100vw-2rem))] grid-cols-2 content-start gap-x-4 gap-y-1 overflow-y-auto rounded-xl border border-sandal-200 bg-surface p-3 shadow-elev-4 lg:grid-cols-3"
            : "min-w-60 rounded-xl border border-sandal-200 bg-surface p-2 shadow-elev-4"}>
            {item.children.map((c) => (
              <li key={c.id} className={wide ? "break-inside-avoid" : ""}>
                <NavLink item={c} className={`block ${subLinkCls} ${wide ? "font-semibold" : ""}`} />
                {c.children.length > 0 && (
                  <ul className="ml-3 border-l border-border pl-2">
                    {c.children.map((g) => <li key={g.id}><NavLink item={g} className={`block ${subLinkCls} py-1.5 text-muted`} /></li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

const hasCurrent = (item: PublicMenuItem, pathname: string): boolean => item.href === pathname || item.children.some((c) => hasCurrent(c, pathname));

/** One drawer row: the link plus, when it has sub-items, a button that opens them (closed by default, open on the current page's branch). */
function MobileRow({ item, onNavigate, depth, pathname }: { item: PublicMenuItem; onNavigate: () => void; depth: number; pathname: string }) {
  const [open, setOpen] = useState(() => hasCurrent(item, pathname) && item.children.length > 0);
  const panelId = useId();
  const row = depth === 0 ? "py-3 text-base font-semibold" : depth === 1 ? "py-2.5 text-[0.95rem] font-medium" : "py-2 text-sm font-normal text-muted";
  return (
    <li className={depth === 0 ? "border-b border-sandal-200 last:border-b-0" : ""}>
      <div className="flex items-center">
        <NavLink item={item} onNavigate={onNavigate} className={`block min-h-11 flex-1 rounded-md px-2 ${row} hover:bg-saffron-50 hover:text-primary aria-[current=page]:text-primary`} />
        {item.children.length > 0 && (
          <button type="button" aria-expanded={open} aria-controls={panelId} aria-label={`${item.label} submenu`} onClick={() => setOpen((o) => !o)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted hover:bg-saffron-50 hover:text-primary">
            <ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
      {item.children.length > 0 && open && (
        <ul id={panelId} className="mb-2 ml-3 border-l border-sandal-200 pl-2">
          {item.children.map((c) => <MobileRow key={c.id} item={c} onNavigate={onNavigate} depth={depth + 1} pathname={pathname} />)}
        </ul>
      )}
    </li>
  );
}

function MobileList({ items, onNavigate }: { items: PublicMenuItem[]; onNavigate: () => void }) {
  const pathname = usePathname();
  return <ul className="flex flex-col">{items.map((i) => <MobileRow key={i.id} item={i} onNavigate={onNavigate} depth={0} pathname={pathname} />)}</ul>;
}

/** Second header row on md+: the admin-managed header menu as a category bar. */
export function DesktopNav({ items }: { items: PublicMenuItem[] }) {
  if (!items.length) return null;
  return (
    <nav aria-label="Main" className="hidden border-t border-sandal-200 md:block">
      <ul className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-1 gap-y-0.5 px-4 py-2 sm:px-6 [&>li:first-child]:-ml-4">{items.map((i) => <DesktopItem key={i.id} item={i} />)}</ul>
    </nav>
  );
}

/** Hamburger + drop-down drawer below md. */
export function MobileNav({ items }: { items: PublicMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) { setSeenPath(pathname); setOpen(false); } // close after navigating
  const btn = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
    if (wasOpen.current) { wasOpen.current = false; btn.current?.focus(); }
  }, [open]);

  if (!items.length) return null;
  return (
    <div className="md:hidden">
      <button ref={btn} type="button" className="icon-btn -ml-2" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((o) => !o)}>
        {open ? <CloseIcon /> : <MenuIcon />}<span className="sr-only">{open ? "Close" : "Open"} navigation</span>
      </button>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-sandal-200 bg-surface px-4 pb-5 pt-4 shadow-elev-4">
          <HeaderSearch id="mobile-q" className="mb-3" inline />
          <MobileList items={items} onNavigate={() => setOpen(false)} />
        </nav>
      )}
    </div>
  );
}
