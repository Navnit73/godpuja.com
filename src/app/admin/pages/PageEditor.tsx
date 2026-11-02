"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, ApiClientError } from "@/lib/api";
import { formatDateTime, istInputToIso } from "@/lib/format";
import { slugify } from "@/lib/slug";
import { emptySeo, pageInputSchema, type PageInput, type SectionInput } from "@/lib/validation/pages";
import type { AdminPage } from "@/server/services/pages";

const newId = () => crypto.randomUUID().slice(0, 12);

const blankSection = (type: SectionInput["type"]): SectionInput =>
  type === "richtext"
    ? { id: newId(), type, enabled: true, data: { markdown: "" } }
    : { id: newId(), type, enabled: true, data: { heading: "", markdown: "", imageUrl: "", imageAlt: "", imagePosition: "left", ctaLabel: "", ctaUrl: "" } };

const SECTION_LABEL: Record<SectionInput["type"], string> = { richtext: "Rich text", imageText: "Image + text" };

type Err = { message?: string } | undefined;

export default function PageEditor({ page, canPublish, readOnly = false }: { page: AdminPage | null; canPublish: boolean; readOnly?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [meta, setMeta] = useState(page);
  const [slugTouched, setSlugTouched] = useState(!!page);
  const [formError, setFormError] = useState<string | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const form = useForm<PageInput>({
    resolver: zodResolver(pageInputSchema),
    defaultValues: page
      ? { title: page.title, slug: page.slug, description: page.description, sections: page.sections, seo: page.seo }
      : { title: "", slug: "", description: "", sections: [], seo: emptySeo },
  });
  const { register, handleSubmit, control, setValue, setError, reset, formState: { errors, isSubmitting, isDirty } } = form;
  // keyName avoids RHF overwriting our section `id` field.
  const { fields, append, remove, move } = useFieldArray({ control, name: "sections", keyName: "_key" });
  const sectionErrors = errors.sections as unknown as Array<Record<string, unknown>> | undefined;
  const reg = (name: string) => register(name as never);
  const dataErr = (i: number, key: string) => (sectionErrors?.[i]?.data as Record<string, Err> | undefined)?.[key]?.message;

  // Warn before closing the tab with unsaved edits.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const titleReg = register("title", {
    onChange: (e) => { if (!slugTouched) setValue("slug", slugify(e.target.value), { shouldValidate: false }); },
  });
  const slugReg = register("slug", { onChange: () => setSlugTouched(true) });

  async function onSubmit(values: PageInput) {
    setFormError(null);
    try {
      if (page) {
        const saved = await api.patch<AdminPage>(`/admin/pages/${page.id}`, { ...values, baseUpdatedAt: meta?.updatedAt ?? page.updatedAt });
        setMeta(saved);
        reset(values);
        toast("Page saved");
        router.refresh();
      } else {
        const created = await api.post<AdminPage>("/admin/pages", values);
        toast("Page created as draft");
        router.replace(`/admin/pages/${created.id}`);
      }
    } catch (e) {
      if (e instanceof ApiClientError) {
        if (e.fields) for (const [k, m] of Object.entries(e.fields)) setError(k as never, { message: m });
        setFormError(e.message);
      } else setFormError("Something went wrong. Try again.");
    }
  }

  async function publish(body: { action: "publish" | "unpublish" } | { action: "schedule"; publishAt: string }, okMsg: string) {
    if (!page) return;
    setBusy(body.action);
    try {
      setMeta(await api.post<AdminPage>(`/admin/pages/${page.id}/publish`, body));
      toast(okMsg);
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiClientError ? e.fields?.publishAt ?? e.message : "Could not update publishing", "error");
    } finally {
      setBusy(null);
    }
  }

  async function rotateToken() {
    if (!page) return;
    setBusy("token");
    try {
      setMeta(await api.post<AdminPage>(`/admin/pages/${page.id}/preview-token`)); // new token + new updatedAt
      toast("Preview link reset. The old link no longer works.");
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "Could not reset link", "error");
    } finally {
      setBusy(null);
    }
  }

  async function copyPreview() {
    if (!meta) return;
    try {
      await navigator.clipboard.writeText(`${location.origin}/preview/${meta.previewToken}`);
      toast("Preview link copied");
    } catch {
      toast("Could not copy. Open the preview and copy the address instead.", "error");
    }
  }

  async function doDelete() {
    if (!page) return;
    setBusy("delete");
    try {
      await api.delete(`/admin/pages/${page.id}`);
      toast("Page deleted");
      router.replace("/admin/pages");
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : "Could not delete", "error");
      setBusy(null);
      setConfirmDelete(false);
    }
  }

  const live = meta && (meta.status === "published" || (meta.status === "scheduled" && meta.publishAt && new Date(meta.publishAt) <= new Date()));

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
      <fieldset disabled={readOnly || isSubmitting} className="min-w-0 space-y-6">
        {formError && <p role="alert" className="alert-error">{formError}</p>}

        <section className="card space-y-4 p-5 hover:shadow-elev-1" aria-labelledby="basics">
          <h2 id="basics" className="font-sans text-lg font-semibold">Basics</h2>
          <Input label="Title" error={errors.title?.message} {...titleReg} />
          <Input label="URL slug" hint="English lowercase letters, numbers and hyphens (also for Hindi titles). Use / for sub-pages, e.g. services/graha-shanti."
            error={errors.slug?.message} {...slugReg} />
          <div>
            <label htmlFor="description" className="label">Description</label>
            <textarea id="description" rows={2} className="input h-auto py-2" aria-invalid={!!errors.description}
              {...register("description")} />
            {errors.description && <p className="field-error">{errors.description.message}</p>}
          </div>
        </section>

        <section className="space-y-4" aria-labelledby="sections">
          <div className="flex items-center justify-between">
            <h2 id="sections" className="font-sans text-lg font-semibold">Content sections</h2>
            {!readOnly && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => append(blankSection("richtext"))}>+ Rich text</Button>
                <Button variant="outline" size="sm" onClick={() => append(blankSection("imageText"))}>+ Image + text</Button>
              </div>
            )}
          </div>
          {typeof errors.sections?.message === "string" && <p className="field-error">{errors.sections.message}</p>}

          {fields.length === 0 && (
            <p className="card p-6 text-center text-sm text-muted hover:shadow-elev-1">No sections yet. Add a rich text or image + text section.</p>
          )}

          {fields.map((f, i) => (
            <div key={f._key} className="card space-y-4 p-5 hover:shadow-elev-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{i + 1}. {SECTION_LABEL[f.type]}</p>
                <div className="flex items-center gap-1">
                  <label className="mr-2 flex items-center gap-2 text-sm">
                    <input type="checkbox" className="size-4 accent-saffron-600" {...reg(`sections.${i}.enabled`)} /> Visible
                  </label>
                  <Button variant="ghost" size="sm" disabled={i === 0} aria-label={`Move section ${i + 1} up`} onClick={() => move(i, i - 1)}>↑</Button>
                  <Button variant="ghost" size="sm" disabled={i === fields.length - 1} aria-label={`Move section ${i + 1} down`} onClick={() => move(i, i + 1)}>↓</Button>
                  <Button variant="ghost" size="sm" aria-label={`Remove section ${i + 1}`} onClick={() => remove(i)}>Remove</Button>
                </div>
              </div>

              {f.type === "richtext" ? (
                <MarkdownField id={`s${i}-md`} label="Content" rows={10} error={dataErr(i, "markdown")} {...reg(`sections.${i}.data.markdown`)} />
              ) : (
                <>
                  <Input label="Heading" error={dataErr(i, "heading")} {...reg(`sections.${i}.data.heading`)} />
                  <MarkdownField id={`s${i}-md`} label="Text" rows={5} error={dataErr(i, "markdown")} {...reg(`sections.${i}.data.markdown`)} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Image URL" placeholder="https://…" error={dataErr(i, "imageUrl")} {...reg(`sections.${i}.data.imageUrl`)} />
                    <Input label="Image description (alt text)" error={dataErr(i, "imageAlt")} {...reg(`sections.${i}.data.imageAlt`)} />
                    <Select label="Image position" {...reg(`sections.${i}.data.imagePosition`)}>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </Select>
                    <span />
                    <Input label="Button label" error={dataErr(i, "ctaLabel")} {...reg(`sections.${i}.data.ctaLabel`)} />
                    <Input label="Button link" placeholder="/contact or https://…" error={dataErr(i, "ctaUrl")} {...reg(`sections.${i}.data.ctaUrl`)} />
                  </div>
                </>
              )}
            </div>
          ))}
        </section>

        <section className="card space-y-4 p-5 hover:shadow-elev-1" aria-labelledby="seo">
          <h2 id="seo" className="font-sans text-lg font-semibold">SEO</h2>
          <Input label="SEO title" hint="Defaults to the page title. Up to 70 characters." error={errors.seo?.title?.message} {...register("seo.title")} />
          <div>
            <label htmlFor="seo-desc" className="label">Meta description</label>
            <textarea id="seo-desc" rows={2} className="input h-auto py-2" aria-invalid={!!errors.seo?.description} {...register("seo.description")} />
            <p className="mt-1 text-xs text-muted">Defaults to the page description. Up to 200 characters.</p>
            {errors.seo?.description && <p className="field-error">{errors.seo.description.message}</p>}
          </div>
          <Input label="Canonical URL" hint="Leave blank to use this page's own URL." error={errors.seo?.canonical?.message} {...register("seo.canonical")} />
          <Input label="Social share image URL" placeholder="https://…" error={errors.seo?.ogImage?.message} {...register("seo.ogImage")} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-saffron-600" {...register("seo.noindex")} /> Hide this page from search engines
          </label>
        </section>
      </fieldset>

      <aside className="space-y-6 lg:sticky lg:top-20" aria-label="Page actions">
        {!readOnly && (
          <div className="card space-y-3 p-5 hover:shadow-elev-1">
            <Button type="submit" loading={isSubmitting} className="w-full">{page ? "Save changes" : "Create page"}</Button>
            {isDirty && page && <p className="text-xs text-warning">You have unsaved changes.</p>}
          </div>
        )}

        {page && meta && (
          <div className="card space-y-4 p-5 hover:shadow-elev-1">
            <div className="flex items-center justify-between">
              <h2 className="font-sans text-lg font-semibold">Publishing</h2>
              <span className={live ? "badge-success" : meta.status === "scheduled" ? "badge-primary" : "badge-muted"}>
                {live ? "Live" : meta.status === "scheduled" ? "Scheduled" : "Draft"}
              </span>
            </div>
            {meta.status === "scheduled" && <p className="text-sm text-muted">Goes live {formatDateTime(meta.publishAt)}</p>}
            {meta.status === "published" && <p className="text-sm text-muted">Published {formatDateTime(meta.publishedAt)}</p>}
            {live && <Link href={`/${meta.slug}`} target="_blank" className="text-sm text-primary underline underline-offset-2">View live page ↗</Link>}

            {canPublish && !readOnly ? (
              <>
                {isDirty && <p className="text-xs text-muted">Save your changes before publishing.</p>}
                <div className="flex flex-wrap gap-2">
                  {meta.status !== "published" && (
                    <Button size="sm" disabled={isDirty} loading={busy === "publish"} onClick={() => publish({ action: "publish" }, "Page published")}>Publish now</Button>
                  )}
                  {meta.status !== "draft" && (
                    <Button size="sm" variant="outline" disabled={isDirty} loading={busy === "unpublish"} onClick={() => publish({ action: "unpublish" }, "Page moved to draft")}>Unpublish</Button>
                  )}
                </div>
                {live ? (
                  <p className="text-xs text-muted">To schedule a new go-live time, unpublish first.</p>
                ) : (
                <div>
                  <label htmlFor="schedule-at" className="label">Schedule (India Standard Time)</label>
                  <input id="schedule-at" type="datetime-local" className="input" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
                  <Button size="sm" variant="outline" className="mt-2" disabled={isDirty || !scheduleAt} loading={busy === "schedule"}
                    onClick={() => publish({ action: "schedule", publishAt: istInputToIso(scheduleAt) }, "Page scheduled")}>Schedule</Button>
                </div>
                )}
              </>
            ) : (
              <p className="text-xs text-muted">You do not have permission to change publishing.</p>
            )}
          </div>
        )}

        {page && meta && (
          <div className="card space-y-3 p-5 hover:shadow-elev-1">
            <h2 className="font-sans text-lg font-semibold">Preview</h2>
            <p className="text-xs text-muted">Anyone with this link can see the saved page, even as a draft. Reset it to revoke access.</p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/preview/${meta.previewToken}`} target="_blank" className="btn-outline btn-sm">Open preview ↗</Link>
              <Button size="sm" variant="ghost" onClick={copyPreview}>Copy link</Button>
              {!readOnly && <Button size="sm" variant="ghost" loading={busy === "token"} onClick={rotateToken}>Reset link</Button>}
            </div>
          </div>
        )}

        {page && !readOnly && (
          <div className="card p-5 hover:shadow-elev-1">
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>Delete page</Button>
          </div>
        )}
      </aside>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this page?">
        <p className="text-sm text-muted">“{page?.title}” will be removed permanently and its URL will stop working.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button variant="danger" loading={busy === "delete"} onClick={doDelete}>Delete</Button>
        </div>
      </Modal>
    </form>
  );
}

function MarkdownField({ id, label, rows, error, ...rest }: { id: string; label: string; rows: number; error?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <textarea id={id} rows={rows} className="input h-auto py-2 font-mono text-sm" aria-invalid={!!error} aria-describedby={error ? `${id}-err ${id}-hint` : `${id}-hint`} {...rest} />
      <p id={`${id}-hint`} className="mt-1 text-xs text-muted">Markdown: ## Heading, **bold**, *italic*, - list, [link](https://…), ![alt](https://…)</p>
      {error && <p id={`${id}-err`} className="field-error">{error}</p>}
    </div>
  );
}
