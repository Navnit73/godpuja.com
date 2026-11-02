import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { listProductsSchema } from "@/lib/validation/catalog";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { listInventory } from "@/server/services/products";
import InventoryClient from "./InventoryClient";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  const user = await currentUser();
  if (!user || !can(user.role, "inventory:write")) return <Forbidden />;
  const raw = await searchParams;
  const pick = <K extends keyof typeof listProductsSchema.shape>(key: K) => {
    const v = raw[key];
    const r = listProductsSchema.shape[key].safeParse(typeof v === "string" && v ? v : undefined);
    return r.success ? r.data : undefined;
  };
  const query = listProductsSchema.parse({ q: pick("q"), lowStock: pick("lowStock"), page: pick("page"), limit: 25 });
  const result = await listInventory(query);
  const href = (page: number) => { const p = new URLSearchParams(); if (query.q) p.set("q", query.q); if (query.lowStock) p.set("lowStock", "1"); if (page > 1) p.set("page", String(page)); const s = p.toString(); return `/admin/inventory${s ? `?${s}` : ""}`; };
  if (result.total > 0 && query.page > result.pages) redirect(href(result.pages));
  return (
    <>
      <PageHeader title="Inventory" description="Adjust stock safely: changes are applied atomically, so they never clash with orders." />
      <form method="get" role="search" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1"><label htmlFor="q" className="label">Search</label><input id="q" name="q" defaultValue={query.q} placeholder="Name or SKU" className="input" /></div>
        <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" name="lowStock" value="1" defaultChecked={!!query.lowStock} /> Low stock only</label>
        <button type="submit" className="btn-outline h-10">Filter</button>
        {(query.q || query.lowStock) && <Link href="/admin/inventory" className="btn-ghost h-10">Clear</Link>}
      </form>
      <InventoryClient key={JSON.stringify(result.items.map((i) => [i.id, i.stock]))} items={result.items} />
      {result.pages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          <p className="text-muted">Page {result.page} of {result.pages} · {result.total} products</p>
          <div className="flex gap-2">
            {result.page > 1 && <Link className="btn-outline btn-sm" href={href(result.page - 1)}>Previous</Link>}
            {result.page < result.pages && <Link className="btn-outline btn-sm" href={href(result.page + 1)}>Next</Link>}
          </div>
        </nav>
      )}
    </>
  );
}
