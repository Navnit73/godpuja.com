import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import Logo from "@/components/Logo";
import { getPublicMenu } from "@/server/public/menus";
import type { PublicMenuItem } from "@/server/services/menus";
import { currentUser } from "@/server/auth/guard";
import AccountMenu, { type HeaderUser } from "./AccountMenu";
import CartLink from "./CartLink";
import HeaderSearch from "./HeaderSearch";
import { SearchIcon } from "./Icons";
import { DesktopNav, MobileNav } from "./NavClient";

/** Keep an item only where `flag` is on; a hidden parent hides its subtree. */
function visibleOn(items: PublicMenuItem[], flag: "showOnDesktop" | "showOnMobile"): PublicMenuItem[] {
  return items.filter((i) => i[flag]).map((i) => ({ ...i, children: visibleOn(i.children, flag) }));
}

export function HeaderShell({ desktopNav, mobileNav, user = null }: { desktopNav?: ReactNode; mobileNav?: ReactNode; user?: HeaderUser | null }) {
  return (
    <>
      <section aria-label="Announcement" className="bg-kumkum-950 text-xs text-sandal-200">
        <p className="mx-auto w-full max-w-7xl truncate px-4 py-2 text-center tracking-wide sm:px-6">
          <span className="text-gold-300" aria-hidden="true">✦ </span>Sacred rituals, made simple<span className="hidden sm:inline"> — everything for your puja, in one place</span><span className="text-gold-300" aria-hidden="true"> ✦</span>
        </p>
      </section>
      <header className="sticky top-0 z-30 border-b border-sandal-200 bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-0 px-3 xs:gap-3 xs:px-4 sm:px-6 md:h-20 md:gap-8">
          {mobileNav}
          <Link href="/" aria-label="GodPuja home" className="shrink-0"><Logo compact /></Link>
          <HeaderSearch className="hidden max-w-xl flex-1 md:block" />
          <div className="ml-auto flex shrink-0 items-center xs:gap-1">
            <Link href="/search" className="icon-btn md:hidden"><SearchIcon /><span className="sr-only">Search</span></Link>
            <AccountMenu user={user} />
            <CartLink />
          </div>
        </div>
        {desktopNav}
      </header>
    </>
  );
}

export default async function SiteHeader() {
  await connection(); // read at request time so the build never needs the database
  // A dedicated "mobile" menu wins on small screens; otherwise the header menu is reused, filtered by visibility flags.
  const read = (key: string) => getPublicMenu(key).catch((e) => { console.error(`[nav] ${key} menu read failed`, e); return null; });
  // Signed-in state is read per request; a failure just shows "Sign in".
  const who = currentUser().then((u) => (u ? { name: u.name, email: u.email, isStaff: u.role !== "customer" } : null)).catch(() => null);
  const [header, mobile, user] = await Promise.all([read("header"), read("mobile"), who]);
  const desktopItems = visibleOn(header?.items ?? [], "showOnDesktop");
  const mobileItems = visibleOn(mobile && mobile.items.length ? mobile.items : header?.items ?? [], "showOnMobile");
  return <HeaderShell desktopNav={<DesktopNav items={desktopItems} />} mobileNav={<MobileNav items={mobileItems} />} user={user} />;
}
