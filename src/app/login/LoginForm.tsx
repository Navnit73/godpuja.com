"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { api, ApiClientError } from "@/lib/api";
import { safeNext } from "@/lib/safe-next";

export default function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setError(null);
    try {
      const me = await api.post<{ role: string }>("/auth/login", values);
      // Customers have no admin access; send them to the storefront instead of bouncing back to /login.
      router.replace(me.role === "customer" ? "/" : next);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not sign in. Try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {error && <p role="alert" className="alert-error">{error}</p>}
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" type="email" autoComplete="email" className="input"
          aria-invalid={!!errors.email} {...register("email")} />
        {errors.email && <p className="field-error">{errors.email.message}</p>}
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <input id="password" type="password" autoComplete="current-password" className="input"
          aria-invalid={!!errors.password} {...register("password")} />
        {errors.password && <p className="field-error">{errors.password.message}</p>}
      </div>
      <button type="submit" disabled={isSubmitting} className="btn-primary w-full disabled:opacity-60">
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
