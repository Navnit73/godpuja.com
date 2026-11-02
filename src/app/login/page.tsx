import { Suspense } from "react";
import Logo from "@/components/Logo";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in — GodPuja", robots: { index: false } };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="card w-full max-w-sm p-8 hover:shadow-elev-1">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <h1 className="mb-6 text-center text-2xl font-semibold">Sign in</h1>
        <Suspense><LoginForm /></Suspense>
      </div>
    </main>
  );
}
