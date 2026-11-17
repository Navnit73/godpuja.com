import type { ReactNode } from "react";
import Breadcrumbs from "./Breadcrumbs";

/** Title band on inner storefront pages: light mist panel, big display title, optional intro and controls. */
export default function PageBand({ title, description, crumbs, children }: { title: string; description?: string; crumbs?: { name: string; href?: string }[]; children?: ReactNode }) {
  return (
    <div className="border-b border-sandal-200 bg-sandal-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6 [&_nav]:mb-1.5">
        {crumbs && <Breadcrumbs items={crumbs} />}
        <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight text-foreground text-balance sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted sm:text-base">{description}</p>}
        {children}
      </div>
    </div>
  );
}
