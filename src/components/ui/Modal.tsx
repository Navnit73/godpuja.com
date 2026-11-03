"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/** Accessible modal on the native <dialog> element (focus trap, Esc to close, inert background). */
export default function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const downOnBackdrop = useRef(false); // only close if the press AND release were on the backdrop
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="modal" aria-labelledby={titleId} onClose={onClose}
      onMouseDown={(e) => { downOnBackdrop.current = e.target === ref.current; }}
      onClick={(e) => { if (e.target === ref.current && downOnBackdrop.current) onClose(); }}>
      {open && (
        <div className="max-h-[85dvh] overflow-y-auto p-5 sm:p-6">
          <h2 id={titleId} className="mb-4 font-sans text-xl font-semibold">{title}</h2>
          {children}
        </div>
      )}
    </dialog>
  );
}
