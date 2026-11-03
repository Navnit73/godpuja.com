import type { ReactNode } from "react";
import Breadcrumbs from "./Breadcrumbs";
import { LotusOrnament, Mandala } from "./Icons";

/** Title band on inner storefront pages: same deep-maroon "dusk" look as the footer, with rangoli dots and a faint mandala. */
export default function PageBand({ title, description, crumbs, children }: { title: string; description?: string; crumbs?: { name: string; href?: string }[]; children?: ReactNode }) {
  return (
    <div className="relative isolate overflow-hidden bg-dusk text-sandal-200">
      <div className="pattern-rangoli absolute inset-0 -z-10 opacity-60" aria-hidden="true" />
      <Mandala className="absolute -right-24 -top-28 -z-10 h-96 w-96 text-gold-300 opacity-15" />
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        {crumbs && <Breadcrumbs items={crumbs} tone="dark" />}
        <h1 className="text-4xl font-semibold text-sandal-50 sm:text-5xl">{title}</h1>
        <LotusOrnament className="mt-3 h-4 w-20 text-gold-300" />
        {description && <p className="mt-3 max-w-3xl text-sandal-200">{description}</p>}
        {children}
      </div>
    </div>
  );
}
