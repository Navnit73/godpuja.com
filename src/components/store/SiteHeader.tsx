import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import Logo from "@/components/Logo";
import { getPublicMenu } from "@/server/public/menus";
import type { PublicMenuItem } from "@/server/services/menus";
import CartLink from "./CartLink";
import HeaderSearch from "./HeaderSearch";
import { SearchIcon, UserIcon } from "./Icons";
import { DesktopNav, MobileNav } from "./NavClient";

/** Keep an item only where `flag` is on; a hidden parent hides its subtree. */
function visibleOn(items: PublicMenuItem[], flag: "showOnDesktop" | "showOnMobile"): PublicMenuItem[] {
  return items.filter((i) => i[flag]).map((i) => ({ ...i, children: visibleOn(i.children, flag) }));
}

export function HeaderShell({ desktopNav, mobileNav }: { desktopNav?: ReactNode; mobileNav?: ReactNode }) {
  return (
    <>
      <section aria-label="Announcement" className="bg-kumkum-950 text-xs text-sandal-200">
        <p className="mx-auto w-full max-w-7xl truncate px-4 py-2 text-center tracking-wide sm:px-6">
          <span className="text-gold-300" aria-hidden="true">✦ </span>Sacred rituals, made simple<span className="hidden sm:inline"> — everything for your puja, in one place</span><span className="text-gold-300" aria-hidden="true"> ✦</span>
        </p>
      </section>
      <header className="sticky top-0 z-30 border-b border-sandal-200 bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 md:h-20 md:gap-8">
          {mobileNav}
          <Link href="/" aria-label="GodPuja home" className="shrink-0"><Logo /></Link>
          <HeaderSearch className="hidden max-w-xl flex-1 md:block" />
          <div className="ml-auto flex items-center gap-1">
            <Link href="/search" className="icon-btn md:hidden"><SearchIcon /><span className="sr-only">Search</span></Link>
            <Link href="/login" className="icon-btn md:w-auto md:gap-2 md:px-3">
              <UserIcon /><span className="sr-only md:not-sr-only md:text-sm md:font-medium">Sign in</span>
            </Link>
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
  const [header, mobile] = await Promise.all([read("header"), read("mobile")]);
  const desktopItems = visibleOn(header?.items ?? [], "showOnDesktop");
  const mobileItems = visibleOn(mobile && mobile.items.length ? mobile.items : header?.items ?? [], "showOnMobile");
  return <HeaderShell desktopNav={<DesktopNav items={desktopItems} />} mobileNav={<MobileNav items={mobileItems} />} />;
}
