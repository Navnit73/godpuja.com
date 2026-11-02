"use client";

import "./globals.css";

// Last-resort boundary (root layout failed). Must render its own <html>/<body>.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-4xl font-semibold">Something went wrong</h1>
        <p className="max-w-md text-muted">The site is temporarily unavailable. Please try again.</p>
        <button type="button" onClick={reset} className="btn-primary">Try again</button>
      </body>
    </html>
  );
}
