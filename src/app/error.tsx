"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error); // surfaced to monitoring later; never shown to the visitor
  }, [error]);
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-muted">We could not load this page. Please try again in a moment.</p>
      <button type="button" onClick={reset} className="btn-primary mt-2">Try again</button>
    </main>
  );
}
