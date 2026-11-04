import type { Metadata } from "next";
import { Suspense } from "react";
import AuthCard from "@/components/store/AuthCard";
import VerifyClient from "./VerifyClient";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function VerifyEmailPage() {
  return (
    <AuthCard title="Confirm your email">
      <Suspense fallback={<p role="status" className="text-muted">Loading…</p>}><VerifyClient /></Suspense>
    </AuthCard>
  );
}
