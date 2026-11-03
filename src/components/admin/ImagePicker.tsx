"use client";
/* eslint-disable @next/next/no-img-element -- remote Cloudinary/admin-provided images; thumbnails only */
import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { api } from "@/lib/api";
import type { MediaItem } from "@/server/services/media";

/** Choose an image from the media library. Calls `onPick` with its URL and stored alt text. */
const PAGE = 36;

export default function ImagePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (url: string, alt: string) => void }) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const req = useRef(0); // only the latest request may update the list (a slow "Load more" must not append to a reloaded list)
  const load = (p: number) => {
    const n = ++req.current;
    setLoading(true); setError(null);
    api.get<MediaItem[]>(`/admin/media?limit=${PAGE}&page=${p}`)
      .then(
        (rows) => { if (n !== req.current) return; setItems((cur) => [...(p === 1 ? [] : cur ?? []), ...rows]); setMore(rows.length === PAGE); setPage(p); },
        () => { if (n === req.current) setError("Could not load the media library."); },
      )
      .finally(() => { if (n === req.current) setLoading(false); });
  };
  useEffect(() => {
    // Reload on every open so images uploaded since (e.g. in another tab) are offered, and a failed load can be retried.
    if (open) queueMicrotask(() => load(1));
  }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="Choose an image">
      {error && <p role="alert" className="alert-error">{error}</p>}
      {!items && !error && <p role="status" className="text-muted">Loading…</p>}
      {items?.length === 0 && <p className="text-muted">The media library is empty. Upload images on the Media page, or paste an image URL instead.</p>}
      <ul className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
        {items?.map((m) => (
          <li key={m.id}>
            <button type="button" className="block w-full overflow-hidden rounded-lg border border-border text-left hover:border-primary focus-visible:outline-2" onClick={() => { onPick(m.url, m.alt || m.filename); onClose(); }}>
              <img src={m.url} alt="" loading="lazy" className="aspect-square w-full object-cover" />
              <span className="block truncate px-2 py-1 text-xs">{m.filename}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-between gap-2">
        {more ? <Button variant="outline" onClick={() => load(page + 1)} loading={loading}>Load more</Button> : <span />}
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}
