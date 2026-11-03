"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { api, ApiClientError } from "@/lib/api";
import { SECTION_LINKS, patchForTarget, targetOf, type LinkTarget } from "@/lib/link-targets";
import { SOCIAL_PLATFORMS, updateFooterSchema, type FooterInput, type FooterLinkInput } from "@/lib/validation/footer";
import type { AdminFooter } from "@/server/services/footer";

type LinkPage = { id: string; title: string; slug: string; live: boolean };
type Column = FooterInput["columns"][number];
type Social = FooterInput["social"][number];
type Errs = Record<string, string>; // key = zod path joined with "."

const newId = () => crypto.randomUUID().slice(0, 12);
const blankLink = (): FooterLinkInput => ({ id: newId(), label: "", type: "page", ref: undefined, url: "", openInNewTab: false, enabled: true });
const swap = <T,>(a: T[], i: number, d: -1 | 1): T[] => {
  const j = i + d;
  if (j < 0 || j >= a.length) return a;
  const c = [...a];
  [c[i], c[j]] = [c[j], c[i]];
  return c;
};
const set = <T,>(a: T[], i: number, patch: Partial<T>) => a.map((x, n) => (n === i ? { ...x, ...patch } : x));
const del = <T,>(a: T[], i: number) => a.filter((_, n) => n !== i);

function Order({ i, len, onMove, onRemove, label }: { i: number; len: number; onMove: (d: -1 | 1) => void; onRemove: () => void; label: string }) {
  return (
    <div className="flex gap-1">
      <button type="button" className="btn-ghost btn-sm px-2 disabled:opacity-40" disabled={i === 0} aria-label={`Move ${label} up`} onClick={() => onMove(-1)}>↑</button>
      <button type="button" className="btn-ghost btn-sm px-2 disabled:opacity-40" disabled={i === len - 1} aria-label={`Move ${label} down`} onClick={() => onMove(1)}>↓</button>
      <button type="button" className="btn-danger btn-sm" aria-label={`Remove ${label}`} onClick={onRemove}>Remove</button>
    </div>
  );
}

function LinkRows({ links, onChange, pages, errs, path }: { links: FooterLinkInput[]; onChange: (l: FooterLinkInput[]) => void; pages: LinkPage[]; errs: Errs; path: string }) {
  return (
    <ul className="space-y-3">
      {links.map((l, i) => {
        const e = (k: string) => errs[`${path}.${i}.${k}`];
        const p = (patch: Partial<FooterLinkInput>) => onChange(set(links, i, patch));
        return (
          <li key={l.id} className="rounded-lg border border-border bg-surface p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Input label="Label" value={l.label} error={e("label")} maxLength={60} onChange={(ev) => p({ label: ev.target.value })} />
              <Select label="Links to" value={targetOf(l)} onChange={(ev) => p(patchForTarget(ev.target.value as LinkTarget, l))}>
                <option value="page">A page</option>
                {SECTION_LINKS.map((s) => <option key={s.key} value={s.key}>{s.option}</option>)}
                <option value="external">Custom link</option>
              </Select>
              {targetOf(l) !== "page" && targetOf(l) !== "external" ? (
                <p className="self-end pb-2 text-sm text-muted">Links to <span className="font-medium text-foreground">{l.url}</span></p>
              ) : l.type === "page" ? (
                <Select label="Page" value={l.ref ?? ""} error={e("ref")} onChange={(ev) => p({ ref: ev.target.value || undefined })}>
                  <option value="">Choose a page…</option>
                  {pages.map((pg) => <option key={pg.id} value={pg.id}>{pg.title} (/{pg.slug}){pg.live ? "" : " — not published"}</option>)}
                </Select>
              ) : (
                <Input label="URL" value={l.url ?? ""} error={e("url")} placeholder="/about or https://…" onChange={(ev) => p({ url: ev.target.value })} />
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                <label className="flex items-center gap-2"><input type="checkbox" checked={l.enabled} onChange={(ev) => p({ enabled: ev.target.checked })} /> Visible</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={l.openInNewTab} onChange={(ev) => p({ openInNewTab: ev.target.checked })} /> New tab</label>
              </div>
              <Order i={i} len={links.length} label={l.label || "link"} onMove={(d) => onChange(swap(links, i, d))} onRemove={() => onChange(del(links, i))} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const Section = ({ title, children, hint }: { title: string; hint?: string; children: React.ReactNode }) => (
  <section className="card space-y-4 p-4 hover:shadow-elev-1">
    <div><h2 className="font-sans text-lg font-semibold">{title}</h2>{hint && <p className="text-sm text-muted">{hint}</p>}</div>
    {children}
  </section>
);

export default function FooterEditor({ initial, pages, pagesTruncated = false }: { initial: AdminFooter; pages: LinkPage[]; pagesTruncated?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { updatedAt: initialVersion, ...initialData } = initial;
  const [version, setVersion] = useState(initialVersion);
  const [f, setF] = useState<FooterInput>(initialData);
  const [dirty, setDirty] = useState(false);
  const [errs, setErrs] = useState<Errs>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const edits = useRef(0); // bumped on every change; a save only clears "dirty" if nothing changed while it was in flight

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const change = (patch: Partial<FooterInput>) => { setF((s) => ({ ...s, ...patch })); setDirty(true); edits.current++; };
  const setColumn = (i: number, patch: Partial<Column>) => change({ columns: set(f.columns, i, patch) });
  const e = (k: string) => errs[k];

  async function save() {
    setGeneral(null);
    const body = { ...f, baseUpdatedAt: version };
    const parsed = updateFooterSchema.safeParse(body);
    if (!parsed.success) {
      const m: Errs = {};
      for (const i of parsed.error.issues) m[i.path.join(".")] ??= i.message;
      setErrs(m);
      setGeneral("Fix the highlighted fields.");
      return;
    }
    setErrs({});
    setBusy(true);
    const rev = edits.current;
    try {
      const saved = await api.put<AdminFooter>("/admin/footer", body);
      setVersion(saved.updatedAt);
      if (edits.current === rev) setDirty(false);
      toast("Footer saved. It is live on the storefront.");
      router.refresh();
    } catch (err) {
      setGeneral(err instanceof ApiClientError ? err.fields?.links ?? err.message : "Could not save the footer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Use <code>{"{year}"}</code> in the copyright text for the current year.</p>
        <Button onClick={save} loading={busy} disabled={!dirty}>Save footer</Button>
      </div>
      {general && <p role="alert" className="alert-error">{general}</p>}
      {pagesTruncated && <p role="status" className="alert-error">Only the first {pages.length} pages (A–Z) can be chosen in the page picker. Use a custom link for others.</p>}

      <Section title="Columns" hint="Up to 6 columns of links. Empty or hidden columns are not shown.">
        {f.columns.map((c, i) => (
          <div key={c.id} className="space-y-3 rounded-xl border border-sandal-300 p-3">
            <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
              <Input label="Column heading" value={c.heading} error={e(`columns.${i}.heading`)} maxLength={60} onChange={(ev) => setColumn(i, { heading: ev.target.value })} />
              <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={c.enabled} onChange={(ev) => setColumn(i, { enabled: ev.target.checked })} /> Visible</label>
            </div>
            <LinkRows links={c.links} pages={pages} errs={errs} path={`columns.${i}.links`} onChange={(links) => setColumn(i, { links })} />
            {e(`columns.${i}.links`) && <p className="field-error">{e(`columns.${i}.links`)}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="outline" size="sm" onClick={() => setColumn(i, { links: [...c.links, blankLink()] })}>Add link</Button>
              <Order i={i} len={f.columns.length} label={c.heading || "column"} onMove={(d) => change({ columns: swap(f.columns, i, d) })} onRemove={() => change({ columns: del(f.columns, i) })} />
            </div>
          </div>
        ))}
        {e("columns") && <p className="field-error">{e("columns")}</p>}
        <Button variant="outline" onClick={() => change({ columns: [...f.columns, { id: newId(), heading: "", enabled: true, links: [] }] })}>Add column</Button>
      </Section>

      <Section title="Contact details">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="ft-address" className="label">Address</label>
            <textarea id="ft-address" rows={3} maxLength={300} className="input h-auto py-2" value={f.contact.address} onChange={(ev) => change({ contact: { ...f.contact, address: ev.target.value } })} />
          </div>
          <Input label="Phone" value={f.contact.phone} error={e("contact.phone")} onChange={(ev) => change({ contact: { ...f.contact, phone: ev.target.value } })} />
          <Input label="Email" type="email" value={f.contact.email} error={e("contact.email")} onChange={(ev) => change({ contact: { ...f.contact, email: ev.target.value } })} />
        </div>
      </Section>

      <Section title="Social links" hint="https links only; they open in a new tab.">
        {f.social.map((s, i) => {
          const p = (patch: Partial<Social>) => change({ social: set(f.social, i, patch) });
          return (
            <div key={s.id} className="grid items-end gap-3 sm:grid-cols-[10rem_1fr_auto_auto]">
              <Select label="Platform" value={s.platform} onChange={(ev) => p({ platform: ev.target.value as Social["platform"] })}>
                {SOCIAL_PLATFORMS.map((x) => <option key={x} value={x}>{x}</option>)}
              </Select>
              <Input label="URL" value={s.url} error={e(`social.${i}.url`)} placeholder="https://…" onChange={(ev) => p({ url: ev.target.value })} />
              <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={s.enabled} onChange={(ev) => p({ enabled: ev.target.checked })} /> Visible</label>
              <div className="pb-1"><Order i={i} len={f.social.length} label={`${s.platform} link`} onMove={(d) => change({ social: swap(f.social, i, d) })} onRemove={() => change({ social: del(f.social, i) })} /></div>
            </div>
          );
        })}
        <Button variant="outline" onClick={() => change({ social: [...f.social, { id: newId(), platform: "facebook", url: "", enabled: true }] })}>Add social link</Button>
      </Section>

      <Section title="Newsletter" hint="Shows an email sign-up box. Addresses are collected on the server; sending emails comes later.">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.newsletter.enabled} onChange={(ev) => change({ newsletter: { ...f.newsletter, enabled: ev.target.checked } })} /> Show newsletter sign-up</label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Heading" value={f.newsletter.heading} error={e("newsletter.heading")} maxLength={80} onChange={(ev) => change({ newsletter: { ...f.newsletter, heading: ev.target.value } })} />
          <Input label="Text" value={f.newsletter.text} error={e("newsletter.text")} maxLength={200} onChange={(ev) => change({ newsletter: { ...f.newsletter, text: ev.target.value } })} />
        </div>
      </Section>

      <Section title="Legal links" hint="Shown next to the copyright line (privacy policy, terms, …).">
        <LinkRows links={f.legalLinks} pages={pages} errs={errs} path="legalLinks" onChange={(legalLinks) => change({ legalLinks })} />
        <Button variant="outline" onClick={() => change({ legalLinks: [...f.legalLinks, blankLink()] })}>Add legal link</Button>
      </Section>

      <Section title="Copyright">
        <Input label="Copyright text" value={f.copyright} error={e("copyright")} maxLength={200} onChange={(ev) => change({ copyright: ev.target.value })} />
      </Section>
    </div>
  );
}
