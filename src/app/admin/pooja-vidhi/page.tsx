import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import EmptyState from "@/components/ui/EmptyState";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { formatDateTime } from "@/lib/format";
import { listVidhiSchema, VIDHI_CATEGORIES, vidhiCategoryLabel } from "@/lib/validation/vidhi";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { listVidhi } from "@/server/services/vidhi";

export const metadata: Metadata = { title: "Pooja Vidhi" };
const STATUSES = ["draft", "published", "scheduled"] as const;
const BASE = "/admin/pooja-vidhi";

export default async function VidhiAdminList({ searchParams }: PageProps<"/admin/pooja-vidhi">) {
  const user = await currentUser();
  if (!user || !can(user.role, "vidhi:read")) return <Forbidden />;
  const canWrite = can(user.role, "vidhi:write");
  const raw = await searchParams;
  const pick = <K extends keyof typeof listVidhiSchema.shape>(key: K) => {
    const v = raw[key];
    const r = listVidhiSchema.shape[key].safeParse(typeof v === "string" && v ? v : undefined);
    return r.success ? r.data : undefined; // one bad value must not discard the others
  };
  const query = listVidhiSchema.parse({ q: pick("q"), status: pick("status"), category: pick("category"), page: pick("page") });
  const result = await listVidhi(query);
  const href = (page: number) => {
    const p = new URLSearchParams();
    if (query.q) p.set("q", query.q);
    if (query.status) p.set("status", query.status);
    if (query.category) p.set("category", query.category);
    if (page > 1) p.set("page", String(page));
    const s = p.toString();
    return `${BASE}${s ? `?${s}` : ""}`;
  };
  if (result.total > 0 && query.page > result.pages) redirect(href(result.pages));
  const filtered = !!(query.q || query.status || query.category);

  return (
    <>
      <PageHeader title="Pooja Vidhi" description="Step-by-step ritual guides with samagri, steps and mantras. Each needs a named reviewer before it can be published."
        actions={canWrite && <Link href={`${BASE}/new`} className="btn-primary">New guide</Link>} />
      <form method="get" role="search" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1"><label htmlFor="q" className="label">Search</label><input id="q" name="q" defaultValue={query.q} placeholder="Title, URL or deity" className="input" /></div>
        <div><label htmlFor="category" className="label">Category</label>
          <select id="category" name="category" defaultValue={query.category ?? ""} className="input"><option value="">All</option>{VIDHI_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></div>
        <div><label htmlFor="status" className="label">Status</label>
          <select id="status" name="status" defaultValue={query.status ?? ""} className="input"><option value="">All</option>{STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}</select></div>
        <button type="submit" className="btn-outline h-10">Filter</button>
        {filtered && <Link href={BASE} className="btn-ghost h-10">Clear</Link>}
      </form>
      <div className="card overflow-x-auto p-0 hover:shadow-elev-1">
        {result.items.length === 0 ? (
          <EmptyState title={filtered ? "No guides match your filters" : "No guides yet"} description={filtered ? "Try a different search or filter." : "Write your first guide, such as the daily Ganesh pooja."}
            action={!filtered && canWrite ? <Link href={`${BASE}/new`} className="btn-primary">New guide</Link> : undefined} />
        ) : (
          <table className="data-table">
            <caption className="sr-only">Pooja Vidhi guides</caption>
            <thead><tr><th scope="col">Title</th><th scope="col">Category</th><th scope="col">Status</th><th scope="col">Reviewed</th><th scope="col">Updated</th></tr></thead>
            <tbody>
              {result.items.map((v) => (
                <tr key={v.id}>
                  <td className="font-medium"><Link href={`${BASE}/${v.id}`} className="hover:text-primary">{v.title}</Link><span className="block text-xs font-normal text-muted">/pooja-vidhi/{v.slug}</span></td>
                  <td>{vidhiCategoryLabel(v.category)}</td>
                  <td>{v.live ? <span className="badge-success">Live</span> : v.status === "scheduled" ? <span className="badge-primary">Scheduled {formatDateTime(v.publishAt)}</span> : <span className="badge-muted">Draft</span>}</td>
                  <td>{v.reviewed ? <span className="badge-success">Reviewed</span> : <span className="badge-muted">Not yet</span>}</td>
                  <td className="whitespace-nowrap text-muted">{formatDateTime(v.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {result.pages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          <p className="text-muted">Page {result.page} of {result.pages} · {result.total} guides</p>
          <div className="flex gap-2">
            {result.page > 1 && <Link className="btn-outline btn-sm" href={href(result.page - 1)}>Previous</Link>}
            {result.page < result.pages && <Link className="btn-outline btn-sm" href={href(result.page + 1)}>Next</Link>}
          </div>
        </nav>
      )}
    </>
  );
}
