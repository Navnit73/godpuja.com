"use client";
/* eslint-disable @next/next/no-img-element -- admin thumbnails of remote images */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ImagePicker from "@/components/admin/ImagePicker";
import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, ApiClientError } from "@/lib/api";
import { paiseToRupees, rupeesToPaise } from "@/lib/money";
import { slugify } from "@/lib/slug";
import { productInputSchema, type ProductInput } from "@/lib/validation/catalog";
import { emptySeo } from "@/lib/validation/pages";
import type { CategoryListItem } from "@/server/services/categories";
import type { AdminProduct } from "@/server/services/products";

// The form edits prices as rupee strings and numbers as strings; they are converted on save.
type VariantForm = { sku: string; options: { k: string; v: string }[]; price: string; salePrice: string; stock: string };
type Form = {
  name: string; slug: string; sku: string; shortDescription: string; description: string; images: { url: string; alt: string }[];
  category: string; brand: string; price: string; salePrice: string; stock: string; lowStockThreshold: string; status: ProductInput["status"];
  isFeatured: boolean; attributes: { name: string; value: string }[]; variants: VariantForm[];
  shipping: { weightGrams: string; length: string; width: string; height: string; freeShipping: boolean }; seo: ProductInput["seo"];
};

const num = (v: string) => (v.trim() === "" ? 0 : Number(v));
const toForm = (p: AdminProduct | null): Form => ({
  name: p?.name ?? "", slug: p?.slug ?? "", sku: p?.sku ?? "", shortDescription: p?.shortDescription ?? "", description: p?.description ?? "", images: p?.images ?? [],
  category: p?.category ?? "", brand: p?.brand ?? "", price: paiseToRupees(p?.price), salePrice: paiseToRupees(p?.salePrice), stock: String(p?.stock ?? 0),
  lowStockThreshold: String(p?.lowStockThreshold ?? 5), status: p?.status ?? "draft", isFeatured: p?.isFeatured ?? false, attributes: p?.attributes ?? [],
  variants: (p?.variants ?? []).map((v) => ({ sku: v.sku, options: Object.entries(v.options).map(([k, val]) => ({ k, v: val })), price: paiseToRupees(v.price), salePrice: paiseToRupees(v.salePrice), stock: String(v.stock) })),
  shipping: { weightGrams: String(p?.shipping.weightGrams ?? 0), length: String(p?.shipping.length ?? 0), width: String(p?.shipping.width ?? 0), height: String(p?.shipping.height ?? 0), freeShipping: p?.shipping.freeShipping ?? false },
  seo: p?.seo ?? { ...emptySeo },
});

/** Form -> API shape. Bad money values become NaN so the schema reports them against the right field. */
function toInput(f: Form): unknown {
  return {
    name: f.name, slug: f.slug, sku: f.sku, shortDescription: f.shortDescription, description: f.description, images: f.images,
    category: f.category || null, brand: f.brand, price: rupeesToPaise(f.price) ?? 0, salePrice: rupeesToPaise(f.salePrice),
    stock: num(f.stock), lowStockThreshold: num(f.lowStockThreshold), status: f.status, isFeatured: f.isFeatured, attributes: f.attributes,
    variants: f.variants.map((v) => ({ sku: v.sku, options: Object.fromEntries(v.options.filter((o) => o.k.trim()).map((o) => [o.k.trim(), o.v])), price: rupeesToPaise(v.price), salePrice: rupeesToPaise(v.salePrice), stock: num(v.stock) })),
    shipping: { weightGrams: num(f.shipping.weightGrams), length: num(f.shipping.length), width: num(f.shipping.width), height: num(f.shipping.height), freeShipping: f.shipping.freeShipping }, seo: f.seo,
  };
}

const Card = ({ title, children, hint }: { title: string; hint?: string; children: React.ReactNode }) => (
  <section className="card space-y-4 p-4 hover:shadow-elev-1"><div><h2 className="font-sans text-lg font-semibold">{title}</h2>{hint && <p className="text-sm text-muted">{hint}</p>}</div>{children}</section>
);
const move = <T,>(a: T[], i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= a.length) return a; const c = [...a]; [c[i], c[j]] = [c[j], c[i]]; return c; };
const mini = "btn-ghost btn-sm px-2 disabled:opacity-40";

export default function ProductEditor({ product, categories, canWrite }: { product: AdminProduct | null; categories: CategoryListItem[]; canWrite: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [version, setVersion] = useState(product?.updatedAt ?? null);
  const [f, setF] = useState<Form>(() => toForm(product));
  const [slugTouched, setSlugTouched] = useState(!!product);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pickIdx, setPickIdx] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isNew = !product;
  const hasVariants = f.variants.length > 0;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (patch: Partial<Form>) => { setF((s) => ({ ...s, ...patch })); setDirty(true); };
  const setVariant = (i: number, patch: Partial<VariantForm>) => set({ variants: f.variants.map((v, n) => (n === i ? { ...v, ...patch } : v)) });
  const e = (k: string) => errs[k];
  const dis = !canWrite;

  async function save() {
    setGeneral(null);
    const bad = [f.price, f.salePrice, ...f.variants.flatMap((v) => [v.price, v.salePrice])].some((x) => Number.isNaN(rupeesToPaise(x)));
    if (bad) { setErrs({ price: "Enter amounts like 199 or 199.50" }); setGeneral("Check the prices."); return; }
    const parsed = productInputSchema.safeParse(toInput(f));
    if (!parsed.success) {
      const m: Record<string, string> = {};
      for (const i of parsed.error.issues) m[i.path.join(".")] ??= i.message;
      setErrs(m); setGeneral("Fix the highlighted fields."); return;
    }
    setErrs({}); setBusy(true);
    try {
      if (product) {
        const saved = await api.patch<AdminProduct>(`/admin/products/${product.id}`, { ...parsed.data, baseUpdatedAt: version });
        setVersion(saved.updatedAt); setF(toForm(saved)); setDirty(false); toast("Product saved"); router.refresh();
      } else {
        const created = await api.post<AdminProduct>("/admin/products", parsed.data);
        setDirty(false); toast("Product created"); router.replace(`/admin/products/${created.id}`);
      }
    } catch (err) {
      if (err instanceof ApiClientError) { setErrs(err.fields ?? {}); setGeneral(err.message); } else setGeneral("Could not save the product");
    } finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true);
    try { await api.delete(`/admin/products/${product!.id}`); setDirty(false); toast("Product deleted"); router.replace("/admin/products"); }
    catch (err) { setConfirmDelete(false); setGeneral(err instanceof ApiClientError ? err.message : "Could not delete"); setBusy(false); }
  }

  return (
    <fieldset disabled={dis} className="space-y-4">
      {general && <p role="alert" className="alert-error">{general}</p>}

      <Card title="Basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Name" value={f.name} error={e("name")} maxLength={160} onChange={(ev) => set({ name: ev.target.value, ...(slugTouched ? {} : { slug: slugify(ev.target.value) }) })} />
          <Input label="URL slug" value={f.slug} error={e("slug")} hint={product && f.slug !== product.slug ? "Old links will redirect automatically." : "Product page: /product/your-slug"} onChange={(ev) => { setSlugTouched(true); set({ slug: ev.target.value }); }} />
          <Input label="SKU" value={f.sku} error={e("sku")} hint="Unique stock code, e.g. DIYA-BRASS-01" onChange={(ev) => set({ sku: ev.target.value })} />
          <Input label="Brand" value={f.brand} error={e("brand")} onChange={(ev) => set({ brand: ev.target.value })} />
          <Select label="Category" value={f.category} error={e("category")} onChange={(ev) => set({ category: ev.target.value })}>
            <option value="">No category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{"— ".repeat(c.level - 1)}{c.name}</option>)}
          </Select>
          <Select label="Status" value={f.status} error={e("status")} onChange={(ev) => set({ status: ev.target.value as Form["status"] })}>
            <option value="draft">Draft (hidden)</option><option value="active">Active (on the storefront)</option><option value="archived">Archived (hidden)</option>
          </Select>
          <div className="sm:col-span-2"><Input label="Short description" value={f.shortDescription} error={e("shortDescription")} maxLength={300} onChange={(ev) => set({ shortDescription: ev.target.value })} /></div>
          <div className="sm:col-span-2">
            <label htmlFor="p-desc" className="label">Description (Markdown)</label>
            <textarea id="p-desc" rows={8} maxLength={20000} className="input h-auto py-2 font-mono text-sm" value={f.description} onChange={(ev) => set({ description: ev.target.value })} />
            {e("description") && <p className="field-error">{e("description")}</p>}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isFeatured} onChange={(ev) => set({ isFeatured: ev.target.checked })} /> Featured product</label>
        </div>
      </Card>

      <Card title="Pricing" hint="Amounts in rupees (₹).">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Price (₹)" inputMode="decimal" value={f.price} error={e("price")} onChange={(ev) => set({ price: ev.target.value })} />
          <Input label="Sale price (₹)" inputMode="decimal" value={f.salePrice} error={e("salePrice")} hint="Optional; must be below the price" onChange={(ev) => set({ salePrice: ev.target.value })} />
        </div>
      </Card>

      <Card title="Images" hint="The first image is the main one. Describe each image for accessibility.">
        <ul className="space-y-3">
          {f.images.map((im, i) => (
            <li key={i} className="grid items-start gap-3 rounded-lg border border-border p-3 sm:grid-cols-[5rem_1fr_auto]">
              {im.url ? <img src={im.url} alt="" referrerPolicy="no-referrer" className="aspect-square w-20 rounded-md object-cover" /> : <div className="aspect-square w-20 rounded-md border border-dashed border-border" />}
              <div className="space-y-2">
                <Input label="Image URL" value={im.url} error={e(`images.${i}.url`)} onChange={(ev) => set({ images: f.images.map((x, n) => (n === i ? { ...x, url: ev.target.value } : x)) })} />
                <Input label="Description (alt text)" value={im.alt} error={e(`images.${i}.alt`)} onChange={(ev) => set({ images: f.images.map((x, n) => (n === i ? { ...x, alt: ev.target.value } : x)) })} />
              </div>
              <div className="flex gap-1">
                <button type="button" className={mini} disabled={i === 0} aria-label={`Move image ${i + 1} up`} onClick={() => set({ images: move(f.images, i, -1) })}>↑</button>
                <button type="button" className={mini} disabled={i === f.images.length - 1} aria-label={`Move image ${i + 1} down`} onClick={() => set({ images: move(f.images, i, 1) })}>↓</button>
                <button type="button" className="btn-danger btn-sm" aria-label={`Remove image ${i + 1}`} onClick={() => set({ images: f.images.filter((_, n) => n !== i) })}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
        {e("images") && <p className="field-error">{e("images")}</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={f.images.length >= 10} onClick={() => setPickIdx(f.images.length)}>Add from library</Button>
          <Button variant="outline" size="sm" disabled={f.images.length >= 10} onClick={() => set({ images: [...f.images, { url: "", alt: "" }] })}>Add by URL</Button>
        </div>
        <ImagePicker open={pickIdx !== null} onClose={() => setPickIdx(null)} onPick={(url, alt) => set({ images: [...f.images, { url, alt }] })} />
      </Card>

      <Card title="Stock" hint={isNew ? "Opening stock. After saving, change stock on the Inventory page so counts stay accurate." : "Stock changes on the Inventory page (so edits here can never overwrite a sale)."}>
        {hasVariants
          ? <p className="text-sm text-muted">This product has variants; stock is tracked per variant below.</p>
          : isNew
            ? <Input label="Opening stock" type="number" min={0} value={f.stock} error={e("stock")} onChange={(ev) => set({ stock: ev.target.value })} />
            : <p className="text-sm">In stock: <strong>{product?.stock}</strong> · <Link href={`/admin/inventory?q=${encodeURIComponent(product?.sku ?? "")}`} className="text-primary underline">Adjust on the Inventory page</Link></p>}
        <Input label="Low-stock alert at or below" type="number" min={0} value={f.lowStockThreshold} error={e("lowStockThreshold")} onChange={(ev) => set({ lowStockThreshold: ev.target.value })} />
      </Card>

      <Card title="Variants" hint="Optional: sizes, weights, etc. Each variant has its own SKU and stock; leave price blank to use the product price.">
        {f.variants.map((v, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-border p-3">
            <div className="grid gap-3 sm:grid-cols-4">
              <Input label="Variant SKU" value={v.sku} error={e(`variants.${i}.sku`)} onChange={(ev) => setVariant(i, { sku: ev.target.value })} />
              <Input label="Price (₹)" inputMode="decimal" value={v.price} error={e(`variants.${i}.price`)} onChange={(ev) => setVariant(i, { price: ev.target.value })} />
              <Input label="Sale price (₹)" inputMode="decimal" value={v.salePrice} error={e(`variants.${i}.salePrice`)} onChange={(ev) => setVariant(i, { salePrice: ev.target.value })} />
              {isNew || !product?.variants.some((x) => x.sku === v.sku.toUpperCase())
                ? <Input label="Opening stock" type="number" min={0} value={v.stock} error={e(`variants.${i}.stock`)} onChange={(ev) => setVariant(i, { stock: ev.target.value })} />
                : <div><span className="label">Stock</span><p className="py-2 text-sm">{product.variants.find((x) => x.sku === v.sku.toUpperCase())?.stock}</p></div>}
            </div>
            <div className="space-y-2">
              <p className="label">Options</p>
              {v.options.map((o, n) => (
                <div key={n} className="flex flex-wrap gap-2">
                  <input aria-label={`Variant ${i + 1} option ${n + 1} name`} className="input w-40" placeholder="Size" value={o.k} onChange={(ev) => setVariant(i, { options: v.options.map((x, m) => (m === n ? { ...x, k: ev.target.value } : x)) })} />
                  <input aria-label={`Variant ${i + 1} option ${n + 1} value`} className="input w-40" placeholder="Large" value={o.v} onChange={(ev) => setVariant(i, { options: v.options.map((x, m) => (m === n ? { ...x, v: ev.target.value } : x)) })} />
                  <button type="button" className="btn-ghost btn-sm" aria-label={`Remove option ${n + 1} of variant ${i + 1}`} onClick={() => setVariant(i, { options: v.options.filter((_, m) => m !== n) })}>Remove</button>
                </div>
              ))}
              {e(`variants.${i}.options`) && <p className="field-error">{e(`variants.${i}.options`)}</p>}
              <Button variant="outline" size="sm" disabled={v.options.length >= 4} onClick={() => setVariant(i, { options: [...v.options, { k: "", v: "" }] })}>Add option</Button>
            </div>
            <Button variant="danger" size="sm" onClick={() => set({ variants: f.variants.filter((_, n) => n !== i) })}>Remove variant</Button>
          </div>
        ))}
        {e("variants") && <p className="field-error">{e("variants")}</p>}
        <Button variant="outline" size="sm" disabled={f.variants.length >= 50} onClick={() => set({ variants: [...f.variants, { sku: "", options: [{ k: "Size", v: "" }], price: "", salePrice: "", stock: "0" }] })}>Add variant</Button>
      </Card>

      <Card title="Attributes" hint="Facts shown on the product page, e.g. Material: Brass.">
        {f.attributes.map((a, i) => (
          <div key={i} className="flex flex-wrap items-start gap-2">
            <input aria-label={`Attribute ${i + 1} name`} className="input w-44" placeholder="Material" value={a.name} onChange={(ev) => set({ attributes: f.attributes.map((x, n) => (n === i ? { ...x, name: ev.target.value } : x)) })} />
            <input aria-label={`Attribute ${i + 1} value`} className="input min-w-48 flex-1" placeholder="Brass" value={a.value} onChange={(ev) => set({ attributes: f.attributes.map((x, n) => (n === i ? { ...x, value: ev.target.value } : x)) })} />
            <button type="button" className="btn-ghost btn-sm" aria-label={`Remove attribute ${i + 1}`} onClick={() => set({ attributes: f.attributes.filter((_, n) => n !== i) })}>Remove</button>
          </div>
        ))}
        {errs.attributes && <p className="field-error">{errs.attributes}</p>}
        <Button variant="outline" size="sm" disabled={f.attributes.length >= 20} onClick={() => set({ attributes: [...f.attributes, { name: "", value: "" }] })}>Add attribute</Button>
      </Card>

      <Card title="Shipping">
        <div className="grid gap-4 sm:grid-cols-4">
          <Input label="Weight (g)" type="number" min={0} value={f.shipping.weightGrams} error={e("shipping.weightGrams")} onChange={(ev) => set({ shipping: { ...f.shipping, weightGrams: ev.target.value } })} />
          <Input label="Length (cm)" type="number" min={0} value={f.shipping.length} onChange={(ev) => set({ shipping: { ...f.shipping, length: ev.target.value } })} />
          <Input label="Width (cm)" type="number" min={0} value={f.shipping.width} onChange={(ev) => set({ shipping: { ...f.shipping, width: ev.target.value } })} />
          <Input label="Height (cm)" type="number" min={0} value={f.shipping.height} onChange={(ev) => set({ shipping: { ...f.shipping, height: ev.target.value } })} />
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.shipping.freeShipping} onChange={(ev) => set({ shipping: { ...f.shipping, freeShipping: ev.target.checked } })} /> Free shipping</label>
      </Card>

      <Card title="Search engines">
        <Input label="SEO title" value={f.seo.title} error={e("seo.title")} onChange={(ev) => set({ seo: { ...f.seo, title: ev.target.value } })} />
        <Input label="SEO description" value={f.seo.description} error={e("seo.description")} onChange={(ev) => set({ seo: { ...f.seo, description: ev.target.value } })} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.seo.noindex} onChange={(ev) => set({ seo: { ...f.seo, noindex: ev.target.checked } })} /> Hide from search engines</label>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {canWrite && <Button onClick={save} loading={busy} disabled={!dirty && !isNew}>{isNew ? "Create product" : "Save changes"}</Button>}
          <Link href="/admin/products" className="btn-ghost">Back</Link>
        </div>
        {canWrite && product && <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete</Button>}
      </div>
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this product?">
        <p className="text-sm text-muted">This cannot be undone. To just hide it, set the status to Archived instead.</p>
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button><Button variant="danger" onClick={remove} loading={busy}>Delete</Button></div>
      </Modal>
    </fieldset>
  );
}
