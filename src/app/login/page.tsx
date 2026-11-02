import { Suspense } from "react";
import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import { safeNext } from "@/lib/safe-next";
import { currentUser } from "@/server/auth/guard";
import { isStaff } from "@/server/auth/permissions";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in — GodPuja", robots: { index: false, follow: false } };

// Already signed in? Skip the form.
async function RedirectIfSignedIn({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const user = await currentUser();
  if (user) {
    const next = (await searchParams).next;
    redirect(isStaff(user.role) ? safeNext(typeof next === "string" ? next : null) : "/");
  }
  return null;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main id="main" tabIndex={-1} className="flex flex-1 items-center justify-center px-4 py-16">
      <Suspense><RedirectIfSignedIn searchParams={searchParams} /></Suspense>
      <div className="card w-full max-w-sm p-8 hover:shadow-elev-1">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <h1 className="mb-6 text-center text-2xl font-semibold">Sign in</h1>
        <Suspense><LoginForm /></Suspense>
      </div>
    </main>
  );
}
