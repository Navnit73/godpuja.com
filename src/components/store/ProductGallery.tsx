"use client";
/* eslint-disable @next/next/no-img-element -- remote CMS images from any host; Cloudinary ones are resized via lib/image */
import { useRef, useState } from "react";
import { responsive, sized } from "@/lib/image";

/** Swipeable photo strip (native scroll-snap). Mobile: dots under the photo; md+: thumbnails that scroll the strip. */
export default function ProductGallery({ images, name }: { images: { url: string; alt: string }[]; name: string }) {
  const [i, setI] = useState(0);
  const strip = useRef<HTMLUListElement>(null);
  if (images.length === 0) return <div className="aspect-square w-full rounded-2xl bg-sandal-100" role="img" aria-label={`No photo of ${name} yet`} />;
  const many = images.length > 1;
  const go = (n: number) => { const el = strip.current; if (el) el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" }); setI(n); };
  const onScroll = () => { const el = strip.current; if (el) setI(Math.round(el.scrollLeft / el.clientWidth)); };
  return (
    <div className="md:sticky md:top-24 md:self-start">
      <ul ref={strip} onScroll={many ? onScroll : undefined} aria-label={many ? "Product photos" : undefined}
        tabIndex={many ? 0 : undefined /* scrollable region must be keyboard-reachable (arrow keys scroll it) */}
        className="scrollbar-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent flex snap-x snap-mandatory overflow-x-auto rounded-2xl border border-sandal-200 bg-sandal-100">
        {images.map((im, n) => (
          <li key={n} className="w-full shrink-0 snap-center">
            <img {...responsive(im.url, "(min-width: 768px) 50vw, 100vw", 640)} alt={im.alt || name} fetchPriority={n === 0 ? "high" : undefined} loading={n === 0 ? undefined : "lazy"} referrerPolicy="no-referrer" className="aspect-square w-full object-cover" />
          </li>
        ))}
      </ul>
      {many && (
        <>
          {/* Mobile: dots (decorative position indicator; swiping or arrow keys are the control). */}
          <div className="mt-3 flex justify-center gap-1.5 md:hidden" aria-hidden="true">
            {images.map((_, n) => <span key={n} className={`h-1.5 rounded-full transition-all duration-200 ease-standard ${n === i ? "w-5 bg-primary" : "w-1.5 bg-sandal-300"}`} />)}
          </div>
          <ul className="mt-4 hidden flex-wrap gap-3 md:flex" aria-label="Choose photo">
            {images.map((im, n) => (
              <li key={n}>
                <button type="button" aria-label={`Show photo ${n + 1} of ${images.length}`} aria-pressed={n === i} onClick={() => go(n)}
                  className={`overflow-hidden rounded-xl border-2 transition ${n === i ? "border-primary ring-2 ring-primary/20" : "border-sandal-200 opacity-80 hover:border-saffron-300 hover:opacity-100"}`}>
                  <img src={sized(im.url, 128)} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-20 w-20 object-cover" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
