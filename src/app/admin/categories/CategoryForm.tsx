"use client";
/* eslint-disable @next/next/no-img-element -- admin thumbnail of a remote image */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ImagePicker from "@/components/admin/ImagePicker";
import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, ApiClientError } from "@/lib/api";
import { slugify } from "@/lib/slug";
import { categoryInputSchema, emptyCategory, type CategoryInput } from "@/lib/validation/catalog";
import type { AdminCategory, CategoryListItem } from "@/server/services/categories";

export default function CategoryForm({ category, all }: { category: AdminCategory | null; all: CategoryListItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const { id, updatedAt: initialVersion, path: initialPath, level: _l, createdAt: _c, ...initial } = category ?? ({ ...emptyCategory } as AdminCategory);
  void _l; void _c;
  const [version, setVersion] = useState(initialVersion);
  const [f, setF] = useState<CategoryInput>(initial);
  const [slugTouched, setSlugTouched] = useState(!!category);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const edits = useRef(0); // bumped on every change; a save only clears "dirty" if nothing changed while it was in flight
  const [pick, setPick] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const change = (patch: Partial<CategoryInput>) => { setF((s) => ({ ...s, ...patch })); setDirty(true); edits.current++; };
  // A category cannot be moved under itself or its own descendants; the server re-checks depth.
  const parents = all.filter((c) => c.id !== id && !(initialPath && c.path.startsWith(initialPath + "/")) && c.level < 3);
  const slugChanged = !!category && f.slug !== category.slug;

  async function save() {
    setGeneral(null);
    const parsed = categoryInputSchema.safeParse(f);
    if (!parsed.success) {
      const m: Record<string, string> = {};
      for (const i of parsed.error.issues) m[i.path.join(".")] ??= i.message;
      setErrs(m); setGeneral("Fix the highlighted fields."); return;
    }
    setErrs({}); setBusy(true);
    const rev = edits.current;
    try {
      if (category) {
        const saved = await api.patch<AdminCategory>(`/admin/categories/${id}`, { ...parsed.data, baseUpdatedAt: version });
        setVersion(saved.updatedAt); if (edits.current === rev) setDirty(false); toast("Category saved"); router.refresh();
      } else {
        const created = await api.post<AdminCategory>("/admin/categories", parsed.data);
        setDirty(false); toast("Category created"); router.replace(`/admin/categories/${created.id}`);
      }
    } catch (e) {
      if (e instanceof ApiClientError) { setErrs(e.fields ?? {}); setGeneral(e.message); } else setGeneral("Could not save the category");
    } finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true);
    try { await api.delete(`/admin/categories/${id}`); setDirty(false); toast("Category deleted"); router.replace("/admin/categories"); }
    catch (e) { setConfirmDelete(false); setGeneral(e instanceof ApiClientError ? e.message : "Could not delete"); setBusy(false); }
  }

  return (
    <div className="space-y-4">
      {general && <p role="alert" className="alert-error">{general}</p>}
      <div className="card grid gap-4 p-4 hover:shadow-elev-1 sm:grid-cols-2">
        <Input label="Name" value={f.name} error={errs.name} maxLength={80} onChange={(e) => { change({ name: e.target.value, ...(slugTouched ? {} : { slug: slugify(e.target.value) }) }); }} />
        <Input label="URL slug" value={f.slug} error={errs.slug} hint={slugChanged ? "Old links will redirect automatically (including subcategories)." : "Lowercase letters, numbers, hyphens"}
          onChange={(e) => { setSlugTouched(true); change({ slug: e.target.value }); }} />
        <Select label="Parent category" value={f.parent ?? ""} error={errs.parent} onChange={(e) => change({ parent: e.target.value || null })}>
          <option value="">None (top level)</option>
          {parents.map((c) => <option key={c.id} value={c.id}>{"— ".repeat(c.level - 1)}{c.name}</option>)}
        </Select>
        <Input label="Sort order" type="number" min={0} value={f.order} error={errs.order} hint="Lower numbers come first" onChange={(e) => change({ order: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })} />
        <div className="sm:col-span-2">
          <label htmlFor="cat-desc" className="label">Description</label>
          <textarea id="cat-desc" rows={3} maxLength={1000} className="input h-auto py-2" value={f.description} onChange={(e) => change({ description: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={f.isActive} onChange={(e) => change({ isActive: e.target.checked })} /> Visible on the storefront (hiding also hides its subcategories and their products)</label>
      </div>

      <div className="card space-y-3 p-4 hover:shadow-elev-1">
        <h2 className="font-sans text-lg font-semibold">Image</h2>
        <div className="grid items-start gap-4 sm:grid-cols-[8rem_1fr]">
          {f.image.url ? <img src={f.image.url} alt="" className="aspect-square w-32 rounded-lg border border-border object-cover" referrerPolicy="no-referrer" /> : <div className="aspect-square w-32 rounded-lg border border-dashed border-border" />}
          <div className="space-y-3">
            <Input label="Image URL" value={f.image.url} error={errs["image.url"]} placeholder="https://…" onChange={(e) => change({ image: { ...f.image, url: e.target.value } })} />
            <Input label="Image description (alt text)" value={f.image.alt} error={errs["image.alt"]} onChange={(e) => change({ image: { ...f.image, alt: e.target.value } })} />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPick(true)}>Choose from library</Button>
              {f.image.url && <Button variant="ghost" size="sm" onClick={() => change({ image: { url: "", alt: "" } })}>Remove</Button>}
            </div>
          </div>
        </div>
        <ImagePicker open={pick} onClose={() => setPick(false)} onPick={(url, alt) => change({ image: { url, alt } })} />
      </div>

      <div className="card grid gap-4 p-4 hover:shadow-elev-1">
        <h2 className="font-sans text-lg font-semibold">Search engines</h2>
        <Input label="SEO title" value={f.seo.title} error={errs["seo.title"]} onChange={(e) => change({ seo: { ...f.seo, title: e.target.value } })} />
        <Input label="SEO description" value={f.seo.description} error={errs["seo.description"]} onChange={(e) => change({ seo: { ...f.seo, description: e.target.value } })} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.seo.noindex} onChange={(e) => change({ seo: { ...f.seo, noindex: e.target.checked } })} /> Hide from search engines</label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button onClick={save} loading={busy} disabled={!dirty && !!category}>{category ? "Save changes" : "Create category"}</Button>
          <Link href="/admin/categories" className="btn-ghost">Back</Link>
        </div>
        {category && <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete</Button>}
      </div>
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this category?">
        <p className="text-sm text-muted">This cannot be undone. A category with subcategories or products cannot be deleted.</p>
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button><Button variant="danger" onClick={remove} loading={busy}>Delete</Button></div>
      </Modal>
    </div>
  );
}
