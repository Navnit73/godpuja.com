"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { PublicProduct } from "@/server/services/products";
import ProductCard from "./ProductCard";

const KEY = "gp_recent_v1";
const MAX = 12;

function readSlugs(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)).slice(0, MAX) : [];
  } catch { return []; }
}

/**
 * "Recently viewed": remembers product slugs in this browser only (nothing is sent anywhere until the cards are loaded),
 * records the current product, and shows the others. Hidden or deleted products are dropped by the server.
 */
export default function RecentlyViewed({ slug }: { slug: string }) {
  const [items, setItems] = useState<PublicProduct[]>([]);
  useEffect(() => {
    const before = readSlugs();
    try { localStorage.setItem(KEY, JSON.stringify([slug, ...before.filter((s) => s !== slug)].slice(0, MAX))); } catch { /* storage blocked */ }
    const others = before.filter((s) => s !== slug).slice(0, 8);
    if (others.length === 0) return;
    let live = true;
    api.post<PublicProduct[]>("/products/cards", { slugs: others }).then((r) => live && setItems(r)).catch(() => { /* a missing row is better than an error */ });
    return () => { live = false; };
  }, [slug]);
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="recent" className="mt-12 sm:mt-16">
      <h2 id="recent" className="section-title">Recently viewed</h2>
      <ul className="scrollbar-none -mx-4 mt-5 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0">
        {items.slice(0, 4).map((p) => <ProductCard key={p.id} p={p} className="w-5/12 shrink-0 snap-start sm:w-auto" />)}
      </ul>
    </section>
  );
}
