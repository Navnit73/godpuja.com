"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, ApiClientError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { seoSettingsSchema, type SeoSettings } from "@/lib/validation/seo";
import type { RedirectItem } from "@/server/services/redirects";
import type { AdminSeoSettings } from "@/server/services/settings";

type Props = { settings: AdminSeoSettings; redirects: { items: RedirectItem[]; total: number; page: number; pages: number }; q: string };

export default function SeoClient({ settings, redirects, q }: Props) {
  const router = useRouter();
  const toast = useToast();
  const { updatedAt: initialVersion, ...initial } = settings;
  const [version, setVersion] = useState(initialVersion);
  const [f, setF] = useState<SeoSettings>(initial);
  const [dirty, setDirty] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rErrs, setRErrs] = useState<Record<string, string>>({});
  const [del, setDel] = useState<RedirectItem | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (patch: Partial<SeoSettings>) => { setF((s) => ({ ...s, ...patch })); setDirty(true); };

  async function save() {
    setGeneral(null);
    const parsed = seoSettingsSchema.safeParse(f);
    if (!parsed.success) {
      const m: Record<string, string> = {};
      for (const i of parsed.error.issues) m[i.path.join(".")] ??= i.message;
      setErrs(m); setGeneral("Fix the highlighted fields."); return;
    }
    setErrs({}); setBusy(true);
    try {
      const saved = await api.put<AdminSeoSettings>("/admin/seo", { ...parsed.data, baseUpdatedAt: version });
      setVersion(saved.updatedAt); setDirty(false); toast("SEO settings saved"); router.refresh();
    } catch (e) {
      setGeneral(e instanceof ApiClientError ? e.message : "Could not save");
    } finally { setBusy(false); }
  }

  async function addRedirect(e: React.FormEvent) {
    e.preventDefault();
    setRErrs({}); setBusy(true);
    try {
      const r = await api.post<{ from: string; to: string }>("/admin/redirects", { from, to });
      toast(`Redirect added: ${r.from} → ${r.to}`); setFrom(""); setTo(""); router.refresh();
    } catch (err) {
      setRErrs(err instanceof ApiClientError ? err.fields ?? { _: err.message } : { _: "Could not add the redirect" });
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!del) return;
    setBusy(true);
    try { await api.delete(`/admin/redirects/${del.id}`); toast("Redirect deleted"); setDel(null); router.refresh(); }
    catch (err) { toast(err instanceof ApiClientError ? err.message : "Could not delete", "error"); setDel(null); }
    finally { setBusy(false); }
  }

  const titleLen = f.defaultTitle.length, homeLen = f.homeTitle.length;
  return (
    <div className="space-y-6">
      <section className="card space-y-4 p-4 hover:shadow-elev-1" aria-labelledby="defaults">
        <h2 id="defaults" className="font-sans text-lg font-semibold">Site defaults</h2>
        {general && <p role="alert" className="alert-error">{general}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Site name" value={f.siteName} error={errs.siteName} hint="Added after every page title, e.g. “About — GodPuja”" onChange={(e) => set({ siteName: e.target.value })} />
          <Input label="Twitter / X handle" value={f.twitterHandle} error={errs.twitterHandle} placeholder="@godpuja" onChange={(e) => set({ twitterHandle: e.target.value })} />
          <Input label="Default title" value={f.defaultTitle} error={errs.defaultTitle} hint={`${titleLen}/70 — used when a page has no title of its own`} onChange={(e) => set({ defaultTitle: e.target.value })} />
          <Input label="Default description" value={f.defaultDescription} error={errs.defaultDescription} hint={`${f.defaultDescription.length}/200`} onChange={(e) => set({ defaultDescription: e.target.value })} />
          <Input label="Default share image URL" value={f.defaultOgImage} error={errs.defaultOgImage} hint="Shown when links are shared, if the page has no image" onChange={(e) => set({ defaultOgImage: e.target.value })} />
          <Input label="Logo URL (for search engines)" value={f.logoUrl} error={errs.logoUrl} onChange={(e) => set({ logoUrl: e.target.value })} />
          <Input label="Homepage title" value={f.homeTitle} error={errs.homeTitle} hint={`${homeLen}/70 — shown as-is (no site name added)`} onChange={(e) => set({ homeTitle: e.target.value })} />
          <Input label="Homepage description" value={f.homeDescription} error={errs.homeDescription} hint={`${f.homeDescription.length}/200`} onChange={(e) => set({ homeDescription: e.target.value })} />
        </div>
        <Button onClick={save} loading={busy} disabled={!dirty}>Save settings</Button>
      </section>

      <section className="card space-y-4 p-4 hover:shadow-elev-1" aria-labelledby="redirects">
        <div>
          <h2 id="redirects" className="font-sans text-lg font-semibold">Redirects (301)</h2>
          <p className="text-sm text-muted">Renamed products, categories and pages are redirected automatically. Add your own for old links. Changes take up to a minute to apply.</p>
        </div>
        <form onSubmit={addRedirect} noValidate className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Input label="Old path" value={from} error={rErrs.from} placeholder="/old-page" onChange={(e) => setFrom(e.target.value)} />
          <Input label="Send visitors to" value={to} error={rErrs.to} placeholder="/new-page or https://…" onChange={(e) => setTo(e.target.value)} />
          <Button type="submit" className="sm:mt-6" loading={busy}>Add redirect</Button>
          {rErrs._ && <p role="alert" className="field-error sm:col-span-3">{rErrs._}</p>}
        </form>
        <form method="get" role="search" className="flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1"><label htmlFor="rq" className="label">Search redirects</label><input id="rq" name="q" defaultValue={q} className="input" /></div>
          <button type="submit" className="btn-outline h-10">Search</button>
          {q && <Link href="/admin/seo" className="btn-ghost h-10">Clear</Link>}
        </form>
        <div className="overflow-x-auto">
          {redirects.items.length === 0 ? <EmptyState title={q ? "No redirects match" : "No redirects yet"} /> : (
            <table className="data-table">
              <caption className="sr-only">Redirects</caption>
              <thead><tr><th scope="col">From</th><th scope="col">To</th><th scope="col">Updated</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {redirects.items.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-sm">{r.from}</td>
                    <td className="break-all font-mono text-sm">{r.to}</td>
                    <td className="whitespace-nowrap text-muted">{formatDateTime(r.updatedAt)}</td>
                    <td><button type="button" className="btn-ghost btn-sm" onClick={() => setDel(r)}>Delete<span className="sr-only"> redirect from {r.from}</span></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {redirects.pages > 1 && (
          <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
            <p className="text-muted">Page {redirects.page} of {redirects.pages} · {redirects.total} redirects</p>
            <div className="flex gap-2">
              {redirects.page > 1 && <Link className="btn-outline btn-sm" href={`/admin/seo?${new URLSearchParams({ ...(q ? { q } : {}), page: String(redirects.page - 1) })}`}>Previous</Link>}
              {redirects.page < redirects.pages && <Link className="btn-outline btn-sm" href={`/admin/seo?${new URLSearchParams({ ...(q ? { q } : {}), page: String(redirects.page + 1) })}`}>Next</Link>}
            </div>
          </nav>
        )}
      </section>
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete this redirect?">
        <p className="text-sm text-muted">Visitors to <code>{del?.from}</code> will get a “not found” page instead.</p>
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={remove} loading={busy}>Delete</Button></div>
      </Modal>
    </div>
  );
}
