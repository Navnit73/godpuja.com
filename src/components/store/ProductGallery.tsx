"use client";
/* eslint-disable @next/next/no-img-element -- remote CMS images; switch to next/image with Cloudinary in Stage 11 */
import { useState } from "react";

export default function ProductGallery({ images, name }: { images: { url: string; alt: string }[]; name: string }) {
  const [i, setI] = useState(0);
  if (images.length === 0) return <div className="aspect-square w-full rounded-xl bg-sandal-100" role="img" aria-label={`No photo of ${name} yet`} />;
  const cur = images[Math.min(i, images.length - 1)];
  return (
    <div>
      <img src={cur.url} alt={cur.alt || name} decoding="async" referrerPolicy="no-referrer" className="aspect-square w-full rounded-xl border border-border object-cover" />
      {images.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Product photos">
          {images.map((im, n) => (
            <li key={n}>
              <button type="button" aria-label={`Show photo ${n + 1} of ${images.length}`} aria-pressed={n === i} onClick={() => setI(n)}
                className={`overflow-hidden rounded-md border-2 ${n === i ? "border-primary" : "border-border"}`}>
                <img src={im.url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-16 w-16 object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
