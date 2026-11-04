"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { api } from "@/lib/api";
import { resetWishlist } from "@/lib/wishlist-store";
import { ChevronDown, UserIcon } from "./Icons";

export type HeaderUser = { name: string; email: string; isStaff: boolean };

/** Header account control: "Sign in" when signed out; otherwise a menu with the user's name, admin link (staff) and Sign out. */
export default function AccountMenu({ user }: { user: HeaderUser | null }) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!user) {
    return (
      <Link href="/login" className="icon-btn md:w-auto md:gap-2 md:px-3">
        <UserIcon /><span className="sr-only md:not-sr-only md:text-sm md:font-medium">Sign in</span>
      </Link>
    );
  }

  async function signOut() {
    setBusy(true);
    setFailed(false);
    try {
      await api.post("/auth/logout");
      resetWishlist();
      setOpen(false);
      router.refresh(); // re-render the header (and any account-aware page) as signed out
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const first = user.name.trim().split(/\s+/)[0] || "Account";
  const item = "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-saffron-50 hover:text-primary";
  return (
    <div ref={wrap} className="relative">
      <button ref={btn} type="button" className="icon-btn md:w-auto md:gap-2 md:px-3" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <UserIcon />
        <span className="sr-only md:not-sr-only md:max-w-28 md:truncate md:text-sm md:font-medium">{first}</span>
        <ChevronDown className="hidden h-3.5 w-3.5 md:block" />
        <span className="sr-only"> — account menu</span>
      </button>
      {open && (
        <div id={id} className="absolute right-0 top-full z-40 mt-2 w-64 rounded-2xl border border-sandal-200 bg-surface p-2 shadow-elev-3">
          <div className="border-b border-sandal-200 px-3 pb-3 pt-2">
            <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <ul className="pt-2">
            {user.isStaff && <li><Link href="/admin" className={item} onClick={() => setOpen(false)}>Admin dashboard</Link></li>}
            <li><Link href="/account" className={item} onClick={() => setOpen(false)}>My account</Link></li>
            <li><Link href="/account/orders" className={item} onClick={() => setOpen(false)}>My orders</Link></li>
            <li><Link href="/cart" className={item} onClick={() => setOpen(false)}>My cart</Link></li>
            <li>
              <button type="button" className={`${item} text-kumkum-700`} onClick={signOut} disabled={busy} aria-busy={busy || undefined}>
                {busy ? "Signing out…" : "Sign out"}
              </button>
            </li>
          </ul>
          {failed && <p role="alert" className="px-3 pb-2 text-xs text-danger">Could not sign out. Try again.</p>}
        </div>
      )}
    </div>
  );
}
