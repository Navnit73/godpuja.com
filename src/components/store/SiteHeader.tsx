import Link from "next/link";
import { connection } from "next/server";
import Logo from "@/components/Logo";
import { getPublicMenu } from "@/server/public/menus";
import type { PublicMenuItem } from "@/server/services/menus";
import NavClient from "./NavClient";

/** Keep an item only where `flag` is on; a hidden parent hides its subtree. */
function visibleOn(items: PublicMenuItem[], flag: "showOnDesktop" | "showOnMobile"): PublicMenuItem[] {
  return items.filter((i) => i[flag]).map((i) => ({ ...i, children: visibleOn(i.children, flag) }));
}

export function HeaderShell({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="GodPuja home" className="shrink-0"><Logo /></Link>
        {children}
      </div>
    </header>
  );
}

export default async function SiteHeader() {
  await connection(); // read at request time so the build never needs the database
  // A dedicated "mobile" menu wins on small screens; otherwise the header menu is reused, filtered by visibility flags.
  const [header, mobile] = await Promise.all([getPublicMenu("header"), getPublicMenu("mobile")]);
  const desktopItems = visibleOn(header?.items ?? [], "showOnDesktop");
  const mobileItems = mobile && mobile.items.length ? mobile.items : visibleOn(header?.items ?? [], "showOnMobile");
  return (
    <HeaderShell>
      <NavClient desktop={desktopItems} mobile={mobileItems} />
    </HeaderShell>
  );
}
