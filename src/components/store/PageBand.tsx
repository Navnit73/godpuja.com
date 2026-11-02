import type { ReactNode } from "react";
import Breadcrumbs from "./Breadcrumbs";
import { LotusOrnament } from "./Icons";

/** Title band at the top of inner storefront pages: soft dawn gradient, breadcrumbs, serif title, lotus ornament. */
export default function PageBand({ title, description, crumbs, children }: { title: string; description?: string; crumbs?: { name: string; href?: string }[]; children?: ReactNode }) {
  return (
    <div className="border-b border-sandal-200 bg-dawn">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        {crumbs && <Breadcrumbs items={crumbs} />}
        <h1 className="text-4xl font-semibold sm:text-5xl">{title}</h1>
        <LotusOrnament className="mt-3 h-4 w-20 text-accent" />
        {description && <p className="mt-3 max-w-3xl text-muted">{description}</p>}
        {children}
      </div>
    </div>
  );
}
