import type { Metadata } from "next";
import { Suspense } from "react";
import AuthCard from "@/components/store/AuthCard";
import ResetForm from "./ResetForm";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Choose a new password" intro="Setting a new password signs you out on every other device.">
      <Suspense fallback={<p role="status" className="text-muted">Loading…</p>}><ResetForm /></Suspense>
    </AuthCard>
  );
}
