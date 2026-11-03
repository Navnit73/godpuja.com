import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import EmptyState from "@/components/ui/EmptyState";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { formatPaise } from "@/lib/money";
import { listProductsSchema } from "@/lib/validation/catalog";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { listCategories } from "@/server/services/categories";
import { listProducts } from "@/server/services/products";

export const metadata: Metadata = { title: "Products" };
const STATUSES = ["draft", "active", "upcoming", "archived"] as const;

export default async function ProductsList({ searchParams }: PageProps<"/admin/products">) {
  const user = await currentUser();
  if (!user || !can(user.role, "products:read")) return <Forbidden />;
  const canWrite = can(user.role, "products:write");
  const raw = await searchParams;
  const pick = <K extends keyof typeof listProductsSchema.shape>(key: K) => {
    const v = raw[key];
    const r = listProductsSchema.shape[key].safeParse(typeof v === "string" && v ? v : undefined);
    return r.success ? r.data : undefined;
  };
  const query = listProductsSchema.parse({ q: pick("q"), status: pick("status"), category: pick("category"), lowStock: pick("lowStock"), page: pick("page") });
  const [result, cats] = await Promise.all([listProducts(query), listCategories()]);
  const href = (page: number) => {
    const p = new URLSearchParams();
    for (const k of ["q", "status", "category", "lowStock"] as const) if (query[k]) p.set(k, String(query[k]));
    if (page > 1) p.set("page", String(page));
    const s = p.toString();
    return `/admin/products${s ? `?${s}` : ""}`;
  };
  if (result.total > 0 && query.page > result.pages) redirect(href(result.pages));
  const filtered = !!(query.q || query.status || query.category || query.lowStock);

  return (
    <>
      <PageHeader title="Products" description="Everything you sell. Only active products appear on the storefront."
        actions={canWrite && <Link href="/admin/products/new" className="btn-primary">New product</Link>} />
      <form method="get" role="search" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1"><label htmlFor="q" className="label">Search</label><input id="q" name="q" defaultValue={query.q} placeholder="Name or SKU" className="input" /></div>
        <div><label htmlFor="status" className="label">Status</label>
          <select id="status" name="status" defaultValue={query.status ?? ""} className="input"><option value="">All</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
        <div><label htmlFor="category" className="label">Category</label>
          <select id="category" name="category" defaultValue={query.category ?? ""} className="input"><option value="">All</option>{cats.map((c) => <option key={c.id} value={c.id}>{"— ".repeat(c.level - 1)}{c.name}</option>)}</select></div>
        <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" name="lowStock" value="1" defaultChecked={!!query.lowStock} /> Low stock</label>
        <button type="submit" className="btn-outline h-10">Filter</button>
        {filtered && <Link href="/admin/products" className="btn-ghost h-10">Clear</Link>}
      </form>
      <div className="card overflow-x-auto p-0 hover:shadow-elev-1">
        {result.items.length === 0 ? (
          <EmptyState title={filtered ? "No products match your filters" : "No products yet"} description={filtered ? "Try a different search or filter." : "Add your first product to start selling."}
            action={!filtered && canWrite ? <Link href="/admin/products/new" className="btn-primary">New product</Link> : undefined} />
        ) : (
          <table className="data-table">
            <caption className="sr-only">Products</caption>
            <thead><tr><th scope="col">Product</th><th scope="col">SKU</th><th scope="col">Category</th><th scope="col">Price</th><th scope="col">Stock</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {result.items.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium"><Link href={`/admin/products/${p.id}`} className="hover:text-primary">{p.name}</Link></td>
                  <td className="text-muted">{p.sku}</td>
                  <td className="text-muted">{p.category ?? "—"}</td>
                  <td className="whitespace-nowrap">{p.salePrice != null ? <><span>{formatPaise(p.salePrice)}</span> <s className="text-muted">{formatPaise(p.price)}</s></> : formatPaise(p.price)}</td>
                  <td>{p.stock}{p.lowStock && <span className="badge-danger ml-2">Low</span>}</td>
                  <td>{p.status === "active" ? <span className="badge-success">Active</span> : p.status === "draft" ? <span className="badge-muted">Draft</span> : p.status === "upcoming" ? <span className="badge bg-gold-100 text-gold-700">Upcoming</span> : <span className="badge-primary">Archived</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
