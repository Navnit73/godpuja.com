import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import GoogleButton from "@/components/store/GoogleButton";
import { googleConfigured } from "@/server/auth/google";
import Logo from "@/components/Logo";
import { safeNext } from "@/lib/safe-next";
import { currentUser } from "@/server/auth/guard";
import { isStaff } from "@/server/auth/permissions";
import LoginForm from "./LoginForm";
import Chakra from "./Chakra";

export const metadata = { title: "Sign in — GodPuja", robots: { index: false, follow: false } };

// Already signed in? Skip the form.
async function RedirectIfSignedIn({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const user = await currentUser();
  if (user) {
    const next = (await searchParams).next;
    redirect(isStaff(user.role) ? safeNext(typeof next === "string" ? next : null) : customerNext(typeof next === "string" ? next : null));
  }
  return null;
}

/** Customers go back where they were (never into /admin), else to their account. */
const customerNext = (n: string | null) => (n && !n.startsWith("/admin") ? safeNext(n, "/account") : "/account");

const GOOGLE_ERRORS: Record<string, string> = {
  google_unavailable: "Google sign-in is not available right now. Use your email and password.",
  google_cancelled: "Google sign-in was cancelled.",
  google_failed: "Google sign-in did not work. Please try again.",
  google_staff: "Staff accounts sign in with email and password.",
  google_conflict: "This email is linked to a different Google account.",
  rate_limited: "Too many attempts. Please wait a few minutes and try again.",
};

// Runtime config (Google keys) and the ?error= code: rendered per request.
async function Extras({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? GOOGLE_ERRORS[sp.error] : undefined;
  const next = typeof sp.next === "string" && !sp.next.startsWith("/admin") ? safeNext(sp.next, "/account") : "/account";
  return (
    <>
      {error && <p role="alert" className="alert-error mb-4">{error}</p>}
      {googleConfigured() && (
        <div className="mb-6 space-y-4">
          <GoogleButton next={next} />
          <p className="text-center text-xs uppercase tracking-wide text-muted">or with email</p>
        </div>
      )}
    </>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main id="main" tabIndex={-1} className="grid flex-1 lg:grid-cols-2">
      <Suspense><RedirectIfSignedIn searchParams={searchParams} /></Suspense>

      {/* Brand panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-kumkum-950 p-12 text-sandal-100 lg:flex">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-saffron-500/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-gold-400/20 blur-3xl" />
        <Chakra className="pointer-events-none absolute -right-40 top-1/2 h-[42rem] w-[42rem] -translate-y-1/2 text-gold-400/25" />
        <Chakra className="pointer-events-none absolute -bottom-28 -left-28 h-72 w-72 text-saffron-400/20" />
        <p className="relative font-[family-name:var(--font-cormorant)] text-3xl font-semibold text-gold-300">GodPuja</p>
        <div className="relative max-w-md">
          <p aria-hidden className="mb-6 text-5xl text-saffron-400 drop-shadow-[0_0_18px_rgb(242_122_26_/_0.6)]">ॐ</p>
          <h2 className="font-[family-name:var(--font-cormorant)] text-5xl font-semibold leading-tight text-white">
            Sacred rituals, made simple.
          </h2>
          <p className="mt-4 text-lg text-sandal-300">
            Sign in to book pujas, track your orders and manage your blessings, all in one place.
          </p>
        </div>
        <p className="relative text-sm text-sandal-400">© GodPuja</p>
      </aside>

      {/* Form panel */}
      <section className="flex items-center justify-center px-4 py-16 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center lg:justify-start"><Logo /></div>
          <h1 className="text-3xl font-semibold">Welcome back</h1>
          <p className="mb-8 mt-2 text-muted">Sign in to continue to your account.</p>
          <Suspense><Extras searchParams={searchParams} /></Suspense>
          <Suspense><LoginForm /></Suspense>
          <div className="mt-6 space-y-2 text-sm text-muted">
            <p><Link href="/forgot-password" className="font-medium text-primary underline">Forgot your password?</Link></p>
            <p>New here? <Link href="/register" className="font-medium text-primary underline">Create an account</Link></p>
          </div>
        </div>
      </section>
    </main>
  );
}
