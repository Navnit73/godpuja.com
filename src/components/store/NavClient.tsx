"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PublicMenuItem } from "@/server/services/menus";

type Props = { desktop: PublicMenuItem[]; mobile: PublicMenuItem[] };

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

const linkCls = "rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-sandal-100 aria-[current=page]:text-primary";

function DesktopItem({ item }: { item: PublicMenuItem }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const pathname = usePathname();
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) { setSeenPath(pathname); setOpen(false); } // close after navigating
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!item.children.length) return <li><NavLink item={item} className={`block ${linkCls}`} /></li>;
  return (
    <li ref={ref} className="relative"
      onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}>
      <div className="flex items-center">
        <NavLink item={item} className={`block ${linkCls} pr-1`} />
        <button type="button" className="rounded-md px-1.5 py-2 text-sm hover:bg-sandal-100" aria-expanded={open}
          aria-label={`${item.label} submenu`} onClick={() => setOpen((o) => !o)}>
          <span aria-hidden="true">▾</span>
        </button>
      </div>
      {open && (
        <ul className="absolute left-0 top-full z-40 mt-1 min-w-56 rounded-lg border border-border bg-surface p-2 shadow-elev-3">
          {item.children.map((c) => (
            <li key={c.id}>
              <NavLink item={c} className={`block ${linkCls}`} />
              {c.children.length > 0 && (
                <ul className="ml-3 border-l border-border pl-2">
                  {c.children.map((g) => <li key={g.id}><NavLink item={g} className={`block ${linkCls} text-muted`} /></li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function MobileList({ items, onNavigate, depth = 0 }: { items: PublicMenuItem[]; onNavigate: () => void; depth?: number }) {
  return (
    <ul className={depth ? "ml-3 border-l border-border pl-2" : "flex flex-col"}>
      {items.map((i) => (
        <li key={i.id}>
          <NavLink item={i} onNavigate={onNavigate} className={`block py-2.5 text-base font-medium hover:text-primary aria-[current=page]:text-primary ${depth ? "text-muted" : ""}`} />
          {i.children.length > 0 && <MobileList items={i.children} onNavigate={onNavigate} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

export default function NavClient({ desktop, mobile }: Props) {
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

  return (
    <>
      {desktop.length > 0 && (
        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-1">{desktop.map((i) => <DesktopItem key={i.id} item={i} />)}</ul>
        </nav>
      )}
      {mobile.length > 0 && (
        <div className="md:hidden">
          <button ref={btn} type="button" className="btn-outline btn-sm" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((o) => !o)}>
            {open ? "Close" : "Menu"}<span className="sr-only"> navigation</span>
          </button>
          {open && (
            <nav id="mobile-nav" aria-label="Mobile" className="absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-border bg-surface px-4 pb-4 shadow-elev-3">
              <MobileList items={mobile} onNavigate={() => setOpen(false)} />
            </nav>
          )}
        </div>
      )}
    </>
  );
}
