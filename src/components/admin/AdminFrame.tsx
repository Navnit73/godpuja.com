"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LogoMark } from "@/components/Logo";
import { ToastProvider } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import Icon, { type IconName } from "./icons";
import { BREADCRUMB_LABELS, NAV_GROUPS, type NavGroup } from "./nav";

type Props = {
  user: { name: string; role: string };
  items: { label: string; href: string; icon: IconName; group: NavGroup }[];
  children: ReactNode;
};

export default function AdminFrame({ user, items, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [logoutError, setLogoutError] = useState(false);

  const menuBtn = useRef<HTMLButtonElement>(null);
  const firstLink = useRef<HTMLAnchorElement>(null);

  // Drawer: Esc closes, focus moves in on open and back to the menu button on close.
  // Focus must be restored AFTER the content stops being inert, hence the effect on `open`.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      firstLink.current?.focus();
      const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
      document.addEventListener("keydown", onKey);
      wasOpen.current = true;
      return () => document.removeEventListener("keydown", onKey);
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      menuBtn.current?.focus();
    }
  }, [open]);

  const isActive = (href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg, i) => ({
    href: "/" + segments.slice(0, i + 1).join("/"),
    label: BREADCRUMB_LABELS[seg] ?? (/^[a-f0-9]{24}$/.test(seg) ? "Edit" : seg.charAt(0).toUpperCase() + seg.slice(1)),
  }));

  async function logout() {
    setBusy(true);
    try {
      await api.post("/auth/logout");
      router.replace("/login");
      router.refresh();
    } catch {
      setBusy(false);
      setLogoutError(true);
    }
  }

  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
  const groups = NAV_GROUPS.map((g) => ({ group: g, links: items.filter((i) => i.group === g) })).filter((g) => g.links.length);
  const firstHref = groups[0]?.links[0]?.href;

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-sandal-100">
        {open && <div className="fixed inset-0 z-30 bg-scrim lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}

        {/* Sidebar: temple-night panel */}
        <aside id="admin-sidebar" aria-label="Admin navigation"
          className={`admin-sidebar bg-kumkum-950 fixed inset-y-0 left-0 z-40 flex w-72 flex-col text-sandal-200 transition-transform duration-300 ease-standard lg:visible lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? "visible translate-x-0" : "invisible -translate-x-full"}`}>
          <div className="flex items-center justify-between px-5 pb-4 pt-5">
            <Link href="/admin" className="flex items-center gap-3 rounded-lg" onClick={() => setOpen(false)}>
              <LogoMark className="h-9 w-9 shadow-elev-2 rounded-xl" />
              <span className="leading-tight">
                <span className="block font-serif text-xl font-semibold text-white">God<span className="text-gold-300">Puja</span></span>
                <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-sandal-400">Admin console</span>
              </span>
            </Link>
            <button type="button" className="rounded-lg p-2 text-sandal-300 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Close navigation" onClick={() => setOpen(false)}>
              <Icon name="close" />
            </button>
          </div>
          <div aria-hidden="true" className="mx-5 h-px bg-gradient-to-r from-transparent via-gold-400/40 to-transparent" />

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {groups.map(({ group, links }) => (
              <div key={group} className="mb-5 last:mb-0">
                <p className="mb-1.5 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-gold-300/70">{group}</p>
                <ul className="flex flex-col gap-0.5">
                  {links.map((i) => (
                    <li key={i.href}>
                      <Link ref={i.href === firstHref ? firstLink : undefined} href={i.href} className="admin-nav-link"
                        aria-current={isActive(i.href) ? "page" : undefined} onClick={() => setOpen(false)}>
                        <Icon name={i.icon} className="h-[1.15rem] w-[1.15rem] shrink-0" />
                        <span className="truncate">{i.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="border-t border-white/10 p-3">
            <Link href="/" target="_blank" className="admin-nav-link mb-2">
              <Icon name="external" className="h-[1.15rem] w-[1.15rem] shrink-0" />
              <span>View storefront</span>
            </Link>
            <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5 ring-1 ring-white/10">
              <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-saffron-500 to-kumkum-600 text-sm font-semibold text-white">{initials}</span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-sm font-medium text-white">{user.name}</p>
                <p className="text-xs capitalize text-sandal-400">{user.role}</p>
              </div>
              <button type="button" onClick={logout} disabled={busy} aria-busy={busy || undefined}
                className="rounded-lg p-2 text-sandal-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                aria-label="Sign out" title="Sign out">
                <Icon name="logout" className="h-[1.15rem] w-[1.15rem]" />
              </button>
            </div>
            {logoutError && <p role="alert" className="mt-2 px-1 text-xs text-kumkum-200">Could not sign out. Try again.</p>}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col" inert={open}>
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-sandal-200 bg-surface/95 px-4 backdrop-blur sm:px-8">
            <button ref={menuBtn} type="button" className="-ml-1 rounded-lg p-2 text-foreground hover:bg-sandal-100 lg:hidden" aria-label="Open navigation"
              aria-controls="admin-sidebar" aria-expanded={open} onClick={() => setOpen(true)}>
              <Icon name="menu" />
            </button>
            <nav aria-label="Breadcrumb" className="min-w-0 flex-1 truncate text-sm text-muted">
              <ol className="flex items-center gap-1">
                {crumbs.map((c, i) => (
                  <li key={c.href} className="flex items-center gap-1">
                    {i > 0 && <Icon name="chevron" className="h-3.5 w-3.5 text-sandal-400" />}
                    {i === crumbs.length - 1
                      ? <span aria-current="page" className="font-semibold text-foreground">{c.label}</span>
                      : <Link href={c.href} className="rounded px-1 hover:text-primary">{c.label}</Link>}
                  </li>
                ))}
              </ol>
            </nav>
            <div className="hidden items-center gap-3 sm:flex">
              <div className="text-right text-xs leading-tight">
                <p className="font-medium text-foreground">{user.name}</p>
                <p className="capitalize text-muted">{user.role}</p>
              </div>
              <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-saffron-500 to-kumkum-600 text-sm font-semibold text-white ring-2 ring-saffron-100">{initials}</span>
            </div>
            <span aria-hidden="true" className="hidden h-8 w-px bg-sandal-200 sm:block" />
            <button type="button" onClick={logout} disabled={busy} aria-busy={busy || undefined} title="Sign out"
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-sandal-300 px-3 text-sm font-medium text-kumkum-700 transition-colors hover:border-kumkum-300 hover:bg-kumkum-50 disabled:opacity-50 sm:px-4">
              <Icon name="logout" className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">{busy ? "Signing out…" : "Sign out"}</span>
            </button>
          </header>
          {logoutError && <p role="alert" className="border-b border-kumkum-200 bg-kumkum-50 px-4 py-2 text-sm text-kumkum-700 sm:px-8">Could not sign out. Try again.</p>}
          <main id="main" tabIndex={-1} className="admin-main mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-8">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
