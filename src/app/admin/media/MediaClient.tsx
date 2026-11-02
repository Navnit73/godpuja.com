"use client";
/* eslint-disable @next/next/no-img-element -- remote Cloudinary thumbnails */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, ApiClientError } from "@/lib/api";
import type { MediaItem } from "@/server/services/media";

const MAX = 5 * 1024 * 1024;

export default function MediaClient({ initial, configured, page, pages, total }: { initial: MediaItem[]; configured: boolean; page: number; pages: number; total: number }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [del, setDel] = useState<MediaItem | null>(null);
  const [alts, setAlts] = useState<Record<string, string>>({});

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setError(null); setBusy(true);
    let done = 0;
    for (const file of files) {
      if (file.size > MAX) { setError(`${file.name} is larger than 5 MB.`); continue; }
      try {
        const form = new FormData(); form.set("file", file);
        const res = await fetch("/api/admin/media", { method: "POST", body: form, credentials: "same-origin" });
        const json = await res.json().catch(() => null);
        if (!res.ok) { setError(`${file.name}: ${json?.error?.fields?.file ?? json?.error?.message ?? "upload failed"}`); continue; }
        done++;
      } catch { setError(`${file.name}: upload failed`); }
    }
    setBusy(false);
    if (done) { toast(done === 1 ? "Image uploaded" : `${done} images uploaded`); router.refresh(); }
  }

  async function saveAlt(m: MediaItem) {
    const alt = alts[m.id];
    if (alt === undefined || alt === m.alt) return;
    try { await api.patch(`/admin/media/${m.id}`, { alt }); toast("Description saved"); router.refresh(); }
    catch (e) { toast(e instanceof ApiClientError ? e.message : "Could not save", "error"); }
  }

  async function remove() {
    if (!del) return;
    setBusy(true);
    try { await api.delete(`/admin/media/${del.id}`); toast("Image deleted"); setDel(null); router.refresh(); }
    catch (e) { setDel(null); setError(e instanceof ApiClientError ? e.message : "Could not delete"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      {!configured && <p role="status" className="alert-error">Image storage is not configured yet, so uploads are disabled. Add the CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET environment variables and restart. You can still paste image URLs into products and categories.</p>}
      {error && <p role="alert" className="alert-error">{error}</p>}
      <div className="card p-4 hover:shadow-elev-1">
        <label htmlFor="media-file" className="label">Upload images</label>
        <input id="media-file" type="file" multiple accept="image/jpeg,image/png,image/gif,image/webp" disabled={!configured || busy} onChange={upload} className="block text-sm" />
        {busy && <p role="status" className="mt-2 text-sm text-muted">Working…</p>}
      </div>
      {initial.length === 0 ? (
        <div className="card hover:shadow-elev-1"><EmptyState title="No images yet" description="Uploaded images appear here and can be chosen in products and categories." /></div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {initial.map((m) => (
            <li key={m.id} className="card overflow-hidden p-0 hover:shadow-elev-1">
              <img src={m.url} alt={m.alt} loading="lazy" referrerPolicy="no-referrer" className="aspect-square w-full object-cover" />
              <div className="space-y-2 p-3">
                <p className="truncate text-sm font-medium" title={m.filename}>{m.filename}</p>
                <p className="text-xs text-muted">{m.width}×{m.height} · {(m.size / 1024).toFixed(0)} KB</p>
                <label className="sr-only" htmlFor={`alt-${m.id}`}>Description of {m.filename}</label>
                <input id={`alt-${m.id}`} className="input h-9 text-sm" placeholder="Description (alt text)" maxLength={200} value={alts[m.id] ?? m.alt}
                  onChange={(e) => setAlts((s) => ({ ...s, [m.id]: e.target.value }))} onBlur={() => saveAlt(m)} />
                <Button variant="danger" size="sm" onClick={() => setDel(m)}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          <p className="text-muted">Page {page} of {pages} · {total} images</p>
          <div className="flex gap-2">
            {page > 1 && <Link className="btn-outline btn-sm" href={`/admin/media?page=${page - 1}`}>Previous</Link>}
            {page < pages && <Link className="btn-outline btn-sm" href={`/admin/media?page=${page + 1}`}>Next</Link>}
          </div>
        </nav>
      )}
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete this image?">
        <p className="text-sm text-muted">It is removed from storage permanently. Images used by a product or category cannot be deleted.</p>
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={remove} loading={busy}>Delete</Button></div>
      </Modal>
    </div>
  );
}
