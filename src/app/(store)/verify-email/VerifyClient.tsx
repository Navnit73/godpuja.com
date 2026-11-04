"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";

/**
 * The token is used only when the person presses the button (a POST). Email security scanners open links with GET
 * and would otherwise burn the single-use token before the customer ever clicks it.
 */
export default function VerifyClient() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<{ kind: "idle" | "busy" | "done" | "error"; text?: string; claimed?: number }>({ kind: "idle" });

  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return <p role="alert" className="alert-error">This link is not valid. Sign in and request a new one from your account.</p>;

  async function confirm() {
    setState({ kind: "busy" });
    try {
      const r = await api.post<{ claimedOrders: number }>("/auth/verify-email", { token });
      setState({ kind: "done", claimed: r.claimedOrders });
    } catch (e) {
      setState({ kind: "error", text: e instanceof ApiClientError ? e.message : "Could not confirm your email. Try again." });
    }
  }

  if (state.kind === "done") {
    return (
      <div className="space-y-4">
        <p role="status" className="alert-success">Your email is confirmed.{state.claimed ? ` ${state.claimed} earlier order${state.claimed === 1 ? " was" : "s were"} added to your account.` : ""}</p>
        <Link href="/account" className="btn-primary w-full">Go to my account</Link>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {state.kind === "error" && <p role="alert" className="alert-error">{state.text}</p>}
      <p className="text-muted">Press the button to confirm this email address for your account.</p>
      <button type="button" className="btn-primary w-full" onClick={confirm} disabled={state.kind === "busy"}>{state.kind === "busy" ? "Confirming…" : "Confirm my email"}</button>
    </div>
  );
}
