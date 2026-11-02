"use client";
/* eslint-disable @next/next/no-img-element -- remote CMS images from any host; Cloudinary ones are resized via lib/image */
import { useState } from "react";
import { responsive, sized } from "@/lib/image";

export default function ProductGallery({ images, name }: { images: { url: string; alt: string }[]; name: string }) {
  const [i, setI] = useState(0);
  if (images.length === 0) return <div className="aspect-square w-full rounded-2xl bg-sandal-100" role="img" aria-label={`No photo of ${name} yet`} />;
  const cur = images[Math.min(i, images.length - 1)];
  return (
    <div>
      <img {...responsive(cur.url, "(min-width: 768px) 50vw, 100vw", 640)} alt={cur.alt || name} fetchPriority="high" referrerPolicy="no-referrer" className="aspect-square w-full rounded-2xl border border-sandal-200 bg-sandal-100 object-cover shadow-elev-1" />
      {images.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Product photos">
          {images.map((im, n) => (
            <li key={n}>
              <button type="button" aria-label={`Show photo ${n + 1} of ${images.length}`} aria-pressed={n === i} onClick={() => setI(n)}
                className={`overflow-hidden rounded-xl border-2 ${n === i ? "border-primary" : "border-sandal-200 hover:border-saffron-300"}`}>
                <img src={sized(im.url, 128)} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-16 w-16 object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
