import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import EmptyState from "@/components/ui/EmptyState";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { formatDateTime } from "@/lib/format";
import { DEVOTIONAL_TYPES, devotionalHref, devotionalLanguageLabel, devotionalTypeLabel, listDevotionalSchema } from "@/lib/validation/devotional";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { countAudioNeedingAttention, listDevotionals } from "@/server/services/devotional";
import type { AudioStatus } from "@/lib/devotional-rules";

export const metadata: Metadata = { title: "Aarti & Mantras" };
const STATUSES = ["draft", "published", "scheduled"] as const;
const BASE = "/admin/aarti-mantras";
const AUDIO: Record<AudioStatus, { label: string; cls: string }> = {
  none: { label: "No audio", cls: "badge-muted" }, ok: { label: "Audio on", cls: "badge-success" }, expiring: { label: "Rights expire soon", cls: "badge-primary" },
  expired: { label: "Rights expired — hidden", cls: "badge-muted" }, withdrawn: { label: "Withdrawn — hidden", cls: "badge-muted" }, unlicensed: { label: "No rights — hidden", cls: "badge-muted" },
};

export default async function DevotionalAdminList({ searchParams }: PageProps<"/admin/aarti-mantras">) {
  const user = await currentUser();
  if (!user || !can(user.role, "devotional:read")) return <Forbidden />;
  const canWrite = can(user.role, "devotional:write");
  const raw = await searchParams;
  const pick = <K extends keyof typeof listDevotionalSchema.shape>(key: K) => {
    const v = raw[key];
    const r = listDevotionalSchema.shape[key].safeParse(typeof v === "string" && v ? v : undefined);
    return r.success ? r.data : undefined;
  };
  const query = listDevotionalSchema.parse({ q: pick("q"), status: pick("status"), type: pick("type"), page: pick("page") });
  const [result, attention] = await Promise.all([listDevotionals(query), countAudioNeedingAttention()]);
  const href = (page: number) => {
    const p = new URLSearchParams();
    if (query.q) p.set("q", query.q);
    if (query.status) p.set("status", query.status);
    if (query.type) p.set("type", query.type);
    if (page > 1) p.set("page", String(page));
    const s = p.toString();
    return `${BASE}${s ? `?${s}` : ""}`;
  };
  if (result.total > 0 && query.page > result.pages) redirect(href(result.pages));
  const filtered = !!(query.q || query.status || query.type);

  return (
    <>
      <PageHeader title="Aarti & Mantras" description="Aarti, mantras, chalisas and stotras. Audio plays only while its rights record is complete, not expired and not withdrawn."
        actions={canWrite && <Link href={`${BASE}/new`} className="btn-primary">New item</Link>} />
      {attention > 0 && <p role="status" className="mb-4 rounded-md bg-saffron-100 p-3 text-sm text-saffron-900">{attention} {attention === 1 ? "recording has" : "recordings have"} rights that are withdrawn, expired or expire within 30 days. Review them below.</p>}
      <form method="get" role="search" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1"><label htmlFor="q" className="label">Search</label><input id="q" name="q" defaultValue={query.q} placeholder="Title, URL or deity" className="input" /></div>
        <div><label htmlFor="type" className="label">Type</label>
          <select id="type" name="type" defaultValue={query.type ?? ""} className="input"><option value="">All</option>{DEVOTIONAL_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></div>
        <div><label htmlFor="status" className="label">Status</label>
          <select id="status" name="status" defaultValue={query.status ?? ""} className="input"><option value="">All</option>{STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}</select></div>
        <button type="submit" className="btn-outline h-10">Filter</button>
        {filtered && <Link href={BASE} className="btn-ghost h-10">Clear</Link>}
      </form>
      <div className="card overflow-x-auto p-0 hover:shadow-elev-1">
        {result.items.length === 0 ? (
          <EmptyState title={filtered ? "Nothing matches your filters" : "Nothing here yet"} description={filtered ? "Try a different search or filter." : "Add your first item, such as the Ganesh aarti."}
            action={!filtered && canWrite ? <Link href={`${BASE}/new`} className="btn-primary">New item</Link> : undefined} />
        ) : (
          <table className="data-table">
            <caption className="sr-only">Aarti and mantras</caption>
            <thead><tr><th scope="col">Title</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">Audio</th><th scope="col">Reviewed</th><th scope="col">Updated</th></tr></thead>
            <tbody>
              {result.items.map((v) => (
                <tr key={v.id}>
                  <td className="font-medium"><Link href={`${BASE}/${v.id}`} className="hover:text-primary">{v.title}</Link><span className="block text-xs font-normal text-muted">{devotionalHref(v.type, v.slug)} · {devotionalLanguageLabel(v.language)}</span></td>
                  <td>{devotionalTypeLabel(v.type)}</td>
                  <td>{v.live ? <span className="badge-success">Live</span> : v.status === "scheduled" ? <span className="badge-primary">Scheduled {formatDateTime(v.publishAt)}</span> : <span className="badge-muted">Draft</span>}</td>
                  <td><span className={AUDIO[v.audio].cls}>{AUDIO[v.audio].label}</span></td>
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
