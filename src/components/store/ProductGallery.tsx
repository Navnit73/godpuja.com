"use client";
/* eslint-disable @next/next/no-img-element -- remote CMS images from any host; Cloudinary ones are resized via lib/image */
import { useState } from "react";
import { responsive, sized } from "@/lib/image";

export default function ProductGallery({ images, name }: { images: { url: string; alt: string }[]; name: string }) {
  const [i, setI] = useState(0);
  if (images.length === 0) return <div className="aspect-square w-full rounded-2xl bg-sandal-100" role="img" aria-label={`No photo of ${name} yet`} />;
  const cur = images[Math.min(i, images.length - 1)];
  return (
    <div className="md:sticky md:top-24 md:self-start">
      <img {...responsive(cur.url, "(min-width: 768px) 50vw, 100vw", 640)} alt={cur.alt || name} fetchPriority="high" referrerPolicy="no-referrer" className="aspect-square w-full rounded-2xl border border-sandal-200 bg-sandal-100 object-cover" />
      {images.length > 1 && (
        <ul className="mt-4 flex flex-wrap gap-3" aria-label="Product photos">
          {images.map((im, n) => (
            <li key={n}>
              <button type="button" aria-label={`Show photo ${n + 1} of ${images.length}`} aria-pressed={n === i} onClick={() => setI(n)}
                className={`overflow-hidden rounded-xl border-2 transition ${n === i ? "border-primary ring-2 ring-primary/20" : "border-sandal-200 opacity-80 hover:border-saffron-300 hover:opacity-100"}`}>
                <img src={sized(im.url, 128)} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-20 w-20 object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
