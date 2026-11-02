"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LogoMark } from "@/components/Logo";
import Button from "@/components/ui/Button";
import { ToastProvider } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { BREADCRUMB_LABELS } from "./nav";

type Props = {
  user: { name: string; role: string };
  items: { label: string; href: string }[];
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

  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        {open && <div className="fixed inset-0 z-30 bg-scrim lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}
        <aside id="admin-sidebar" aria-label="Admin navigation"
          className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-border bg-surface p-4 transition-transform lg:visible lg:static lg:translate-x-0 ${open ? "visible translate-x-0" : "invisible -translate-x-full"}`}>
          <Link href="/admin" className="mb-6 flex items-center gap-2.5 px-2 py-1">
            <LogoMark className="h-8 w-8" />
            <span className="font-serif text-xl font-semibold">God<span className="text-primary">Puja</span></span>
          </Link>
          <nav className="flex flex-col gap-1">
            {items.map((i, idx) => (
              <Link key={i.href} ref={idx === 0 ? firstLink : undefined} href={i.href} className="sidebar-link"
                aria-current={isActive(i.href) ? "page" : undefined} onClick={() => setOpen(false)}>
                {i.label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col" inert={open}>
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6">
            <button ref={menuBtn} type="button" className="btn-ghost -ml-2 px-3 lg:hidden" aria-label="Open navigation"
              aria-controls="admin-sidebar" aria-expanded={open} onClick={() => setOpen(true)}>
              ☰
            </button>
            <nav aria-label="Breadcrumb" className="min-w-0 flex-1 truncate text-sm text-muted">
              <ol className="flex items-center gap-1.5">
                {crumbs.map((c, i) => (
                  <li key={c.href} className="flex items-center gap-1.5">
                    {i > 0 && <span aria-hidden="true">/</span>}
                    {i === crumbs.length - 1
                      ? <span aria-current="page" className="font-medium text-foreground">{c.label}</span>
                      : <Link href={c.href} className="hover:text-primary">{c.label}</Link>}
                  </li>
                ))}
              </ol>
            </nav>
            <div className="hidden text-right text-xs leading-tight sm:block">
              <p className="font-medium">{user.name}</p>
              <p className="text-muted capitalize">{user.role}</p>
            </div>
            <Button variant="outline" size="sm" onClick={logout} loading={busy}>Sign out</Button>
            {logoutError && <span role="alert" className="text-xs text-danger">Could not sign out. Try again.</span>}
          </header>
          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
