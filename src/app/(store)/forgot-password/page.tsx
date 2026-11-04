import type { Metadata } from "next";
import Link from "next/link";
import AuthCard from "@/components/store/AuthCard";
import ForgotForm from "./ForgotForm";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Forgot your password?" intro="Enter your email and we will send you a link to choose a new one.">
      <ForgotForm />
      <p className="mt-6 text-sm text-muted"><Link href="/login" className="font-medium text-primary underline">Back to sign in</Link></p>
    </AuthCard>
  );
}
