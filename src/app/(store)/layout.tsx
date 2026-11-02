import { Suspense, type ReactNode } from "react";
import SiteHeader, { HeaderShell } from "@/components/store/SiteHeader";

// Storefront chrome. Admin and login sit outside this group and keep their own layouts.
export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={<HeaderShell />}>
        <SiteHeader />
      </Suspense>
      {children}
    </>
  );
}
