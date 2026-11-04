"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFieldArray, useForm, useWatch, type Control, type UseFormSetValue } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import ImagePicker from "@/components/admin/ImagePicker";
import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, ApiClientError } from "@/lib/api";
import { formatDateTime, isoToIstInput, istInputToIso } from "@/lib/format";
import { slugify } from "@/lib/slug";
import { emptyVidhi, VIDHI_CATEGORIES, vidhiHref, vidhiInputSchema, type VidhiInput } from "@/lib/validation/vidhi";
import { publishProblems } from "@/lib/vidhi-rules";
import type { AdminVidhi } from "@/server/services/vidhi";
import type { z } from "zod";

// The form works with the schema's input type (defaults not yet applied) and submits its output type.
type FormValues = z.input<typeof vidhiInputSchema>;
type Err = { message?: string } | undefined;
const errOf = (e: unknown, ...path: (string | number)[]) => ((path.reduce<unknown>((a, k) => (a as Record<string | number, unknown> | undefined)?.[k], e) as Err)?.message);

const toDefaults = (v: AdminVidhi): FormValues => ({
  title: v.title, slug: v.slug, category: v.category, deity: v.deity, summary: v.summary, significance: v.significance, samagri: v.samagri, preparation: v.preparation,
  steps: v.steps, mantras: v.mantras, body: v.body, relatedAarti: v.relatedAarti, relatedProducts: v.relatedProducts, relatedVidhi: v.relatedVidhi, tags: v.tags,
  durationMinutes: v.durationMinutes, coverImageUrl: v.coverImageUrl, coverImageAlt: v.coverImageAlt, author: v.author, reviewer: v.reviewer, reviewedAt: v.reviewedAt, seo: v.seo,
});

function MarkdownField({ id, label, rows, error, hint, ...rest }: { id: string; label: string; rows: number; error?: string; hint?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <textarea id={id} rows={rows} className="input h-auto py-2 font-mono text-sm" aria-invalid={!!error} aria-describedby={error ? `${id}-err ${id}-hint` : `${id}-hint`} {...rest} />
      <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint ?? "Markdown: ## Heading, **bold**, - list, [link](https://…)"}</p>
      {error && <p id={`${id}-err`} className="field-error">{error}</p>}
    </div>
  );
}

/** Comma-separated slugs or tags, stored as a list. The text is kept as typed; the list is updated on every keystroke. */
function CsvField({ name, label, hint, control, setValue, error, readOnly }: { name: "relatedProducts" | "relatedAarti" | "relatedVidhi" | "tags"; label: string; hint: string; control: Control<FormValues>; setValue: UseFormSetValue<FormValues>; error?: string; readOnly: boolean }) {
  const value = useWatch({ control, name }) as string[] | undefined;
  const [text, setText] = useState((value ?? []).join(", "));
  return (
    <Input label={label} hint={hint} value={text} readOnly={readOnly} error={error}
      onChange={(e) => { setText(e.target.value); setValue(name, e.target.value.split(",").map((s) => s.trim()).filter(Boolean), { shouldDirty: true }); }} />
  );
}

export default function VidhiEditor({ vidhi, canPublish, readOnly = false }: { vidhi: AdminVidhi | null; canPublish: boolean; readOnly?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [meta, setMeta] = useState(vidhi);
  const [slugTouched, setSlugTouched] = useState(!!vidhi);
  const [formError, setFormError] = useState<string | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pickCover, setPickCover] = useState(false);

  const form = useForm<FormValues, unknown, VidhiInput>({ resolver: zodResolver(vidhiInputSchema), defaultValues: vidhi ? toDefaults(vidhi) : (emptyVidhi as FormValues) });
  const { register, handleSubmit, control, setValue, setError, reset, formState: { errors, isSubmitting, isDirty } } = form;
  const samagri = useFieldArray({ control, name: "samagri", keyName: "_key" });
  const steps = useFieldArray({ control, name: "steps", keyName: "_key" });
  const mantras = useFieldArray({ control, name: "mantras", keyName: "_key" });
  const coverUrl = useWatch({ control, name: "coverImageUrl" });
  const reviewedAt = useWatch({ control, name: "reviewedAt" });
  const reg = (name: string) => register(name as never);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const titleReg = register("title", { onChange: (e) => { if (!slugTouched) setValue("slug", slugify(e.target.value), { shouldValidate: false }); } });
  const slugReg = register("slug", { onChange: () => setSlugTouched(true) });
  const locked = busy !== null || isSubmitting;

  async function onSubmit(values: VidhiInput) {
    if (busy !== null) return;
    setFormError(null);
    try {
      if (vidhi) {
        const saved = await api.patch<AdminVidhi>(`/admin/pooja-vidhi/${vidhi.id}`, { ...values, baseUpdatedAt: meta?.updatedAt ?? vidhi.updatedAt });
        setMeta(saved); reset(toDefaults(saved)); toast("Guide saved"); router.refresh();
      } else {
        const created = await api.post<AdminVidhi>("/admin/pooja-vidhi", values);
        toast("Guide created as draft"); router.replace(`/admin/pooja-vidhi/${created.id}`);
      }
    } catch (e) {
      if (e instanceof ApiClientError) {
        if (e.fields) for (const [k, m] of Object.entries(e.fields)) setError(k as never, { message: m });
        setFormError(e.message);
      } else setFormError("Something went wrong. Try again.");
    }
  }

  async function publish(body: { action: "publish" | "unpublish" } | { action: "schedule"; publishAt: string }, ok: string) {
    if (!vidhi || locked) return;
    setBusy(body.action);
    try { setMeta(await api.post<AdminVidhi>(`/admin/pooja-vidhi/${vidhi.id}/publish`, body)); toast(ok); router.refresh(); }
    catch (e) { toast(e instanceof ApiClientError ? e.fields?.publishAt ?? e.message : "Could not update publishing", "error"); }
    finally { setBusy(null); }
  }
  async function rotateToken() {
    if (!vidhi || locked) return;
    setBusy("token");
    try { setMeta(await api.post<AdminVidhi>(`/admin/pooja-vidhi/${vidhi.id}/preview-token`)); toast("Preview link reset. The old link no longer works."); }
    catch (e) { toast(e instanceof ApiClientError ? e.message : "Could not reset link", "error"); } finally { setBusy(null); }
  }
  async function copyPreview() {
    if (!meta) return;
    try { await navigator.clipboard.writeText(`${location.origin}/preview/pooja-vidhi/${meta.previewToken}`); toast("Preview link copied"); }
    catch { toast("Could not copy. Open the preview and copy the address instead.", "error"); }
  }
  async function doDelete() {
    if (!vidhi || locked) return;
    setBusy("delete");
    try { await api.delete(`/admin/pooja-vidhi/${vidhi.id}`); toast("Guide deleted"); router.replace("/admin/pooja-vidhi"); router.refresh(); }
    catch (e) { toast(e instanceof ApiClientError ? e.message : "Could not delete", "error"); setBusy(null); setConfirmDelete(false); }
  }

  const live = meta && (meta.status === "published" || (meta.status === "scheduled" && meta.publishAt && new Date(meta.publishAt) <= new Date()));
  const problems = meta ? publishProblems({ summary: meta.summary, steps: meta.steps, body: meta.body, reviewer: meta.reviewer, reviewedAt: meta.reviewedAt }) : {};
  const ready = Object.keys(problems).length === 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid items-start gap-6 lg:grid-cols-3">
      <fieldset disabled={readOnly || isSubmitting} className="min-w-0 space-y-6 lg:col-span-2">
        {formError && <p role="alert" className="alert-error">{formError}</p>}

        <section className="card space-y-4 p-5 hover:shadow-elev-1" aria-labelledby="basics">
          <h2 id="basics" className="font-sans text-lg font-semibold">Basics</h2>
          <Input label="Title" error={errors.title?.message} {...titleReg} />
          <Input label="URL slug" hint="English lowercase letters, numbers and hyphens, e.g. ganesh-chaturthi-pooja. The guide lives at /pooja-vidhi/<slug>." error={errors.slug?.message} {...slugReg} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Category" error={errors.category?.message} {...register("category")}>{VIDHI_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</Select>
            <Input label="Deity (optional)" error={errors.deity?.message} {...register("deity")} />
            <Input label="Time needed in minutes (optional)" inputMode="numeric" error={errors.durationMinutes?.message}
              {...register("durationMinutes", { setValueAs: (v) => (v === "" || v == null ? null : Number(v)) })} />
          </div>
          <div className="space-y-3">
            <Input label="Cover image URL (optional)" placeholder="https://…" error={errors.coverImageUrl?.message} {...register("coverImageUrl")} />
            {!readOnly && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPickCover(true)}>Choose from library</Button>
                {!!coverUrl && <Button variant="ghost" size="sm" onClick={() => { setValue("coverImageUrl", "", { shouldDirty: true }); setValue("coverImageAlt", "", { shouldDirty: true }); }}>Remove image</Button>}
              </div>
            )}
            {!!coverUrl && <Input label="Cover image description (alt text)" error={errors.coverImageAlt?.message} {...register("coverImageAlt")} />}
          </div>
        </section>

        <section className="card space-y-4 p-5 hover:shadow-elev-1" aria-labelledby="intro">
          <h2 id="intro" className="font-sans text-lg font-semibold">Introduction and significance</h2>
          <MarkdownField id="summary" label="Introduction" rows={4} error={errors.summary?.message} {...register("summary")} hint="Shown first, and used for cards and search results. Up to 2000 characters." />
          <MarkdownField id="significance" label="Significance (optional)" rows={5} error={errors.significance?.message} {...register("significance")} />
        </section>

        <section className="space-y-3" aria-labelledby="samagri">
          <div className="flex items-center justify-between">
            <h2 id="samagri" className="font-sans text-lg font-semibold">Samagri list</h2>
            {!readOnly && <Button variant="outline" size="sm" onClick={() => samagri.append({ item: "", quantity: "", note: "", productSlug: "" })}>+ Add item</Button>}
          </div>
          {samagri.fields.length === 0 && <p className="card p-5 text-center text-sm text-muted hover:shadow-elev-1">No items yet. Add what the devotee needs; link an item to a shop product so they can buy it.</p>}
          {samagri.fields.map((f, i) => (
            <div key={f._key} className="card space-y-3 p-4 hover:shadow-elev-1">
              <div className="flex items-center justify-between"><p className="text-sm font-medium">Item {i + 1}</p>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" disabled={i === 0} aria-label={`Move item ${i + 1} up`} onClick={() => samagri.move(i, i - 1)}>↑</Button>
                  <Button variant="ghost" size="sm" disabled={i === samagri.fields.length - 1} aria-label={`Move item ${i + 1} down`} onClick={() => samagri.move(i, i + 1)}>↓</Button>
                  <Button variant="ghost" size="sm" aria-label={`Remove item ${i + 1}`} onClick={() => samagri.remove(i)}>Remove</Button>
                </div></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Item" error={errOf(errors, "samagri", i, "item")} {...reg(`samagri.${i}.item`)} />
                <Input label="Quantity" error={errOf(errors, "samagri", i, "quantity")} {...reg(`samagri.${i}.quantity`)} />
                <Input label="Note (optional)" error={errOf(errors, "samagri", i, "note")} {...reg(`samagri.${i}.note`)} />
                <Input label="Shop product slug (optional)" hint="e.g. brass-diya" error={errOf(errors, "samagri", i, "productSlug")} {...reg(`samagri.${i}.productSlug`)} />
              </div>
            </div>
          ))}
        </section>

        <section className="card space-y-4 p-5 hover:shadow-elev-1" aria-labelledby="prep">
          <h2 id="prep" className="font-sans text-lg font-semibold">Preparation</h2>
          <MarkdownField id="preparation" label="How to prepare (optional)" rows={4} error={errors.preparation?.message} {...register("preparation")} />
        </section>

        <section className="space-y-3" aria-labelledby="steps">
          <div className="flex items-center justify-between">
            <h2 id="steps" className="font-sans text-lg font-semibold">Steps</h2>
            {!readOnly && <Button variant="outline" size="sm" onClick={() => steps.append({ title: "", body: "", mantra: "" })}>+ Add step</Button>}
          </div>
          {steps.fields.length === 0 && <p className="card p-5 text-center text-sm text-muted hover:shadow-elev-1">No steps yet. Steps are numbered for the reader in the order you list them.</p>}
          {steps.fields.map((f, i) => (
            <div key={f._key} className="card space-y-3 p-4 hover:shadow-elev-1">
              <div className="flex items-center justify-between"><p className="text-sm font-medium">Step {i + 1}</p>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" disabled={i === 0} aria-label={`Move step ${i + 1} up`} onClick={() => steps.move(i, i - 1)}>↑</Button>
                  <Button variant="ghost" size="sm" disabled={i === steps.fields.length - 1} aria-label={`Move step ${i + 1} down`} onClick={() => steps.move(i, i + 1)}>↓</Button>
                  <Button variant="ghost" size="sm" aria-label={`Remove step ${i + 1}`} onClick={() => steps.remove(i)}>Remove</Button>
                </div></div>
              <Input label="Heading (optional)" error={errOf(errors, "steps", i, "title")} {...reg(`steps.${i}.title`)} />
              <MarkdownField id={`step-${i}-body`} label="What to do" rows={4} error={errOf(errors, "steps", i, "body")} {...reg(`steps.${i}.body`)} />
              <div>
                <label htmlFor={`step-${i}-mantra`} className="label">Mantra for this step (optional)</label>
                <textarea id={`step-${i}-mantra`} lang="sa" rows={2} className="input h-auto py-2" {...reg(`steps.${i}.mantra`)} />
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-3" aria-labelledby="mantras">
          <div className="flex items-center justify-between">
            <h2 id="mantras" className="font-sans text-lg font-semibold">Mantras</h2>
            {!readOnly && <Button variant="outline" size="sm" onClick={() => mantras.append({ title: "", text: "", meaning: "" })}>+ Add mantra</Button>}
          </div>
          {mantras.fields.map((f, i) => (
            <div key={f._key} className="card space-y-3 p-4 hover:shadow-elev-1">
              <div className="flex items-center justify-between"><p className="text-sm font-medium">Mantra {i + 1}</p>
                <Button variant="ghost" size="sm" aria-label={`Remove mantra ${i + 1}`} onClick={() => mantras.remove(i)}>Remove</Button></div>
              <Input label="Name" error={errOf(errors, "mantras", i, "title")} {...reg(`mantras.${i}.title`)} />
              <div>
                <label htmlFor={`mantra-${i}-text`} className="label">Mantra</label>
                <textarea id={`mantra-${i}-text`} lang="sa" rows={3} className="input h-auto py-2" aria-invalid={!!errOf(errors, "mantras", i, "text")} {...reg(`mantras.${i}.text`)} />
                {errOf(errors, "mantras", i, "text") && <p className="field-error">{errOf(errors, "mantras", i, "text")}</p>}
              </div>
              <div>
                <label htmlFor={`mantra-${i}-meaning`} className="label">Meaning (optional)</label>
                <textarea id={`mantra-${i}-meaning`} rows={2} className="input h-auto py-2" {...reg(`mantras.${i}.meaning`)} />
              </div>
            </div>
          ))}
        </section>

        <section className="card space-y-4 p-5 hover:shadow-elev-1" aria-labelledby="more">
          <h2 id="more" className="font-sans text-lg font-semibold">More text and links</h2>
          <MarkdownField id="body" label="Additional text (optional)" rows={5} error={errors.body?.message} {...register("body")} hint="Anything that does not fit above. Guides moved from the old Guides section land here." />
          <CsvField name="relatedProducts" label="Related products (shop slugs)" hint="Comma-separated, e.g. brass-diya, camphor. Shown as “Essentials for this pooja”." control={control} setValue={setValue} error={errors.relatedProducts?.message} readOnly={readOnly} />
          <CsvField name="relatedVidhi" label="Related guides (slugs)" hint="Comma-separated slugs of other guides." control={control} setValue={setValue} error={errors.relatedVidhi?.message} readOnly={readOnly} />
          <CsvField name="relatedAarti" label="Related aarti (slugs)" hint="Comma-separated. Shown once the Aarti section is live." control={control} setValue={setValue} error={errors.relatedAarti?.message} readOnly={readOnly} />
          <CsvField name="tags" label="Tags" hint="Comma-separated, e.g. diwali, lakshmi, evening." control={control} setValue={setValue} error={errors.tags?.message} readOnly={readOnly} />
        </section>

        <section className="card space-y-4 p-5 hover:shadow-elev-1" aria-labelledby="review">
          <h2 id="review" className="font-sans text-lg font-semibold">Author and review</h2>
          <p className="text-sm text-muted">Religious content must be checked for accuracy and tradition before it is published. Name who did and when.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Written by (optional)" error={errors.author?.message} {...register("author")} />
            <Input label="Reviewed by" error={errors.reviewer?.message} {...register("reviewer")} />
            <Input label="Date reviewed" type="date" value={reviewedAt ? isoToIstInput(reviewedAt).slice(0, 10) : ""} error={errors.reviewedAt?.message}
              onChange={(e) => setValue("reviewedAt", e.target.value ? istInputToIso(`${e.target.value}T00:00`) : "", { shouldDirty: true, shouldValidate: true })} />
          </div>
        </section>

        <section className="card space-y-4 p-5 hover:shadow-elev-1" aria-labelledby="seo">
          <h2 id="seo" className="font-sans text-lg font-semibold">SEO</h2>
          <Input label="SEO title" hint="Defaults to the title. Up to 70 characters." error={errors.seo?.title?.message} {...register("seo.title")} />
          <div>
            <label htmlFor="seo-desc" className="label">Meta description</label>
            <textarea id="seo-desc" rows={2} className="input h-auto py-2" aria-invalid={!!errors.seo?.description} {...register("seo.description")} />
            <p className="mt-1 text-xs text-muted">Defaults to the introduction.</p>
            {errors.seo?.description && <p className="field-error">{errors.seo.description.message}</p>}
          </div>
          <Input label="Canonical URL" hint="Leave blank to use this guide's own URL." error={errors.seo?.canonical?.message} {...register("seo.canonical")} />
          <Input label="Social share image URL" placeholder="https://…" error={errors.seo?.ogImage?.message} {...register("seo.ogImage")} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-saffron-600" {...register("seo.noindex")} /> Hide this guide from search engines</label>
        </section>
      </fieldset>

      <aside className="space-y-6 lg:sticky lg:top-20" aria-label="Guide actions">
        {!readOnly && (
          <div className="card space-y-3 p-5 hover:shadow-elev-1">
            <Button type="submit" loading={isSubmitting} disabled={busy !== null} className="w-full">{vidhi ? "Save changes" : "Create guide"}</Button>
            {isDirty && vidhi && <p className="text-xs text-warning">You have unsaved changes.</p>}
          </div>
        )}

        {vidhi && meta && (
          <div className="card space-y-4 p-5 hover:shadow-elev-1">
            <div className="flex items-center justify-between">
              <h2 className="font-sans text-lg font-semibold">Publishing</h2>
              <span className={live ? "badge-success" : meta.status === "scheduled" ? "badge-primary" : "badge-muted"}>{live ? "Live" : meta.status === "scheduled" ? "Scheduled" : "Draft"}</span>
            </div>
            {meta.status === "scheduled" && <p className="text-sm text-muted">Goes live {formatDateTime(meta.publishAt)}</p>}
            {meta.status === "published" && <p className="text-sm text-muted">Published {formatDateTime(meta.publishedAt)}</p>}
            {live && <Link href={vidhiHref(meta.slug)} target="_blank" className="text-sm text-primary underline underline-offset-2">View live guide ↗</Link>}
            {!live && !ready && (
              <div className="rounded-md bg-sandal-100 p-3 text-sm" role="status">
                <p className="font-medium">Before this can be published:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted">{Object.values(problems).map((m) => <li key={m}>{m.replace(" before publishing", "")}</li>)}</ul>
                <p className="mt-1 text-xs text-muted">Save your changes to update this list.</p>
              </div>
            )}
            {canPublish && !readOnly ? (
              <>
                {isDirty && <p className="text-xs text-muted">Save your changes before publishing.</p>}
                <div className="flex flex-wrap gap-2">
                  {meta.status !== "published" && <Button size="sm" disabled={isDirty || locked || !ready} loading={busy === "publish"} onClick={() => publish({ action: "publish" }, "Guide published")}>Publish now</Button>}
                  {meta.status !== "draft" && <Button size="sm" variant="outline" disabled={isDirty || locked} loading={busy === "unpublish"} onClick={() => publish({ action: "unpublish" }, "Guide moved to draft")}>Unpublish</Button>}
                </div>
                {live ? <p className="text-xs text-muted">To schedule a new go-live time, unpublish first.</p> : (
                  <div>
                    <label htmlFor="schedule-at" className="label">Schedule (India Standard Time)</label>
                    <input id="schedule-at" type="datetime-local" className="input" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
                    <Button size="sm" variant="outline" className="mt-2" disabled={isDirty || !scheduleAt || locked || !ready} loading={busy === "schedule"} onClick={() => publish({ action: "schedule", publishAt: istInputToIso(scheduleAt) }, "Guide scheduled")}>Schedule</Button>
                  </div>
                )}
              </>
            ) : <p className="text-xs text-muted">You do not have permission to change publishing.</p>}
          </div>
        )}

        {vidhi && meta && (
          <div className="card space-y-3 p-5 hover:shadow-elev-1">
            <h2 className="font-sans text-lg font-semibold">Preview</h2>
            <p className="text-xs text-muted">Anyone with this link can see the saved guide, even as a draft. Reset it to revoke access.</p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/preview/pooja-vidhi/${meta.previewToken}`} target="_blank" className="btn-outline btn-sm">Open preview ↗</Link>
              <Button size="sm" variant="ghost" onClick={copyPreview}>Copy link</Button>
              {!readOnly && <Button size="sm" variant="ghost" disabled={locked} loading={busy === "token"} onClick={rotateToken}>Reset link</Button>}
            </div>
          </div>
        )}

        {vidhi && !readOnly && <div className="card p-5 hover:shadow-elev-1"><Button variant="danger" size="sm" disabled={locked} onClick={() => setConfirmDelete(true)}>Delete guide</Button></div>}
      </aside>

      <ImagePicker open={pickCover} onClose={() => setPickCover(false)} onPick={(url, alt) => { setValue("coverImageUrl", url, { shouldDirty: true, shouldValidate: true }); setValue("coverImageAlt", alt, { shouldDirty: true, shouldValidate: true }); }} />

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this guide?">
        <p className="text-sm text-muted">“{vidhi?.title}” will be removed permanently and its URL will stop working.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button variant="danger" loading={busy === "delete"} disabled={locked && busy !== "delete"} onClick={doDelete}>Delete</Button>
        </div>
      </Modal>
    </form>
  );
}
