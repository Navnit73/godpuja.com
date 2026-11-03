import Link from "next/link";
import { redirect } from "next/navigation";
import EmptyState from "@/components/ui/EmptyState";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { formatDateTime } from "@/lib/format";
import { KIND_META, listPagesSchema, type PageKind } from "@/lib/validation/pages";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { listPages, type PageListItem } from "@/server/services/pages";

const STATUSES = ["draft", "published", "scheduled"] as const;

function StatusBadge({ p }: { p: PageListItem }) {
  if (p.live) return <span className="badge-success">Live</span>;
  if (p.status === "scheduled") return <span className="badge-primary">Scheduled</span>;
  return <span className="badge-muted">Draft</span>;
}

const COPY: Record<PageKind, { description: string; empty: string; newLabel: string }> = {
  page: { description: "Create and publish content pages. Each page gets its own URL.", empty: "Create your first page, such as About or Contact.", newLabel: "New page" },
  blog: { description: "Write and publish blog posts. They appear at /blog and can be featured on the homepage.", empty: "Write your first post, such as a festival story or puja tips.", newLabel: "New post" },
  guide: { description: "Publish how-to guides. They appear at /guides and can be featured on the homepage.", empty: "Create your first guide, such as how to perform a Satyanarayan puja.", newLabel: "New guide" },
};

/** Shared list for pages, blog posts and guides (one model, filtered by kind). */
export default async function PagesListView({ kind, searchParams }: { kind: PageKind; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const meta = KIND_META[kind];
  const copy = COPY[kind];
  const base = meta.admin;
  const user = await currentUser();
  if (!user || !can(user.role, "pages:read")) return <Forbidden />;
  const canWrite = can(user.role, "pages:write");

  const raw = await searchParams;
  const pick = <K extends keyof typeof listPagesSchema.shape>(key: K) => {
    const v = raw[key];
    const r = listPagesSchema.shape[key].safeParse(typeof v === "string" && v ? v : undefined);
    return r.success ? r.data : undefined;
  };
  const query = listPagesSchema.parse({ q: pick("q"), status: pick("status"), page: pick("page"), kind });
  const result = await listPages(query);

  const href = (page: number) => {
    const p = new URLSearchParams();
    if (query.q) p.set("q", query.q);
    if (query.status) p.set("status", query.status);
    if (page > 1) p.set("page", String(page));
    const s = p.toString();
    return `${base}${s ? `?${s}` : ""}`;
  };
  if (result.total > 0 && query.page > result.pages) redirect(href(result.pages));
  const filtered = !!(query.q || query.status);

  return (
    <>
      <PageHeader title={meta.plural} description={copy.description}
        actions={canWrite && <Link href={`${base}/new`} className="btn-primary">{copy.newLabel}</Link>} />

      <form method="get" role="search" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="q" className="label">Search</label>
          <input id="q" name="q" defaultValue={query.q} placeholder="Title or URL" className="input" />
        </div>
        <div>
          <label htmlFor="status" className="label">Status</label>
          <select id="status" name="status" defaultValue={query.status ?? ""} className="input">
            <option value="">All</option>
            {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-outline h-10">Filter</button>
        {filtered && <Link href={base} className="btn-ghost h-10">Clear</Link>}
      </form>

      <div className="card overflow-x-auto p-0 hover:shadow-elev-1">
        {result.items.length === 0 ? (
          <EmptyState title={filtered ? `No ${meta.plural.toLowerCase()} match your filters` : `No ${kind === "page" ? "pages" : meta.plural.toLowerCase()} yet`}
            description={filtered ? "Try a different search or status." : copy.empty}
            action={!filtered && canWrite ? <Link href={`${base}/new`} className="btn-primary">{copy.newLabel}</Link> : undefined} />
        ) : (
          <table className="data-table">
            <caption className="sr-only">{meta.plural}</caption>
            <thead>
              <tr><th scope="col">Title</th><th scope="col">URL</th><th scope="col">Status</th><th scope="col">Publish time</th><th scope="col">Updated</th></tr>
            </thead>
            <tbody>
              {result.items.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium"><Link href={`${base}/${p.id}`} className="hover:text-primary">{p.title}</Link></td>
                  <td className="text-muted">/{p.slug}</td>
                  <td><StatusBadge p={p} /></td>
                  <td className="whitespace-nowrap text-muted">{p.status === "scheduled" ? formatDateTime(p.publishAt) : "—"}</td>
                  <td className="whitespace-nowrap text-muted">{formatDateTime(p.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {result.pages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          <p className="text-muted">Page {result.page} of {result.pages} · {result.total} items</p>
          <div className="flex gap-2">
            {result.page > 1 && <Link className="btn-outline btn-sm" href={href(result.page - 1)}>Previous</Link>}
            {result.page < result.pages && <Link className="btn-outline btn-sm" href={href(result.page + 1)}>Next</Link>}
          </div>
        </nav>
      )}
    </>
  );
}
