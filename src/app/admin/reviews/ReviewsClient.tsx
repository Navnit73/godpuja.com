"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { api, ApiClientError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { ReviewStatus } from "@/lib/validation/reviews";
import type { AdminReview } from "@/server/services/reviews";

export default function ReviewsClient({ initial, status }: { initial: AdminReview[]; status: ReviewStatus }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, run: () => Promise<unknown>, done: string) {
    setBusy(id); setError(null);
    try { await run(); toast(done); router.refresh(); } catch (e) { setError(e instanceof ApiClientError ? e.message : "Something went wrong. Try again."); } finally { setBusy(null); }
  }

  if (initial.length === 0) return <div className="card p-0"><EmptyState title={`No ${status} reviews`} description={status === "pending" ? "New reviews waiting for you will appear here." : undefined} /></div>;
  return (
    <div className="space-y-3">
      {error && <p role="alert" className="alert-error">{error}</p>}
      <ul className="space-y-3">
        {initial.map((r) => (
          <li key={r.id} className="card space-y-2 p-4 hover:shadow-elev-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm"><Link href={`/product/${r.productSlug}`} className="font-medium text-primary underline" target="_blank" rel="noopener noreferrer">{r.productName}<span className="sr-only"> (opens in a new tab)</span></Link> · <span aria-label={`${r.rating} out of 5 stars`}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span></p>
              <p className="text-xs text-muted">{r.displayName} · {formatDateTime(r.createdAt)}</p>
            </div>
            {r.title && <p className="font-medium">{r.title}</p>}
            <p className="whitespace-pre-line text-sm">{r.body}</p>
            {r.moderation && <p className="text-xs text-muted">{r.status === "published" ? "Published" : "Rejected"} by {r.moderation.by} · {formatDateTime(r.moderation.at)}{r.moderation.note && ` — ${r.moderation.note}`}</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              {r.status !== "published" && <Button size="sm" loading={busy === r.id} disabled={!!busy} onClick={() => act(r.id, () => api.patch(`/admin/reviews/${r.id}`, { status: "published" }), "Review published")}>Publish</Button>}
              {r.status !== "rejected" && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act(r.id, () => api.patch(`/admin/reviews/${r.id}`, { status: "rejected" }), r.status === "published" ? "Review unpublished" : "Review rejected")}>{r.status === "published" ? "Unpublish" : "Reject"}</Button>}
              <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => act(r.id, () => api.delete(`/admin/reviews/${r.id}`), "Review deleted")} aria-label={`Delete review by ${r.displayName} of ${r.productName}`}>Delete</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
