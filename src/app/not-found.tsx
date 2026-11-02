import Link from "next/link";
import Logo from "@/components/Logo";

export const metadata = { title: "Page not found", robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <Logo />
      <div className="divider-gold" />
      <h1 className="text-4xl font-semibold">Page not found</h1>
      <p className="max-w-md text-muted">This page could not be found. It may have moved or is not published yet.</p>
      <Link href="/" className="btn-primary mt-2">Back to home</Link>
    </main>
  );
}
