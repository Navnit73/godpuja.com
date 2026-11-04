import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import AuthCard from "@/components/store/AuthCard";
import GoogleButton from "@/components/store/GoogleButton";
import { googleConfigured } from "@/server/auth/google";
import { env } from "@/server/env";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = { title: "Create an account", robots: { index: false, follow: true } };

async function Body() {
  await connection(); // runtime configuration
  if (env().ALLOW_PUBLIC_REGISTRATION !== "true") return <p className="alert-error">New accounts cannot be created right now. You can still check out as a guest.</p>;
  return (
    <div className="space-y-5">
      {googleConfigured() && <><GoogleButton next="/account" label="Sign up with Google" /><p className="text-center text-xs uppercase tracking-wide text-muted">or with email</p></>}
      <RegisterForm />
    </div>
  );
}

export default function RegisterPage() {
  return (
    <AuthCard title="Create an account" intro="Track orders, save addresses and check out faster.">
      <Suspense fallback={<p role="status" className="text-muted">Loading…</p>}><Body /></Suspense>
      <p className="mt-6 text-sm text-muted">Already have an account? <Link href="/login" className="font-medium text-primary underline">Sign in</Link></p>
    </AuthCard>
  );
}
