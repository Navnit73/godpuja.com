import type { ReactNode } from "react";

/** Centered card for sign-up, password and verification pages inside the storefront layout. */
export default function AuthCard({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <main id="main" tabIndex={-1} className="flex w-full flex-1 items-start justify-center px-4 py-12 sm:py-16">
      <div className="panel w-full max-w-md p-6 sm:p-8">
        <h1 className="text-3xl font-semibold">{title}</h1>
        {intro && <div className="mb-6 mt-2 text-muted">{intro}</div>}
        {children}
      </div>
    </main>
  );
}
