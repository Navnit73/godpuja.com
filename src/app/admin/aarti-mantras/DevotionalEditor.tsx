"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch, type Control, type UseFormSetValue } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import ImagePicker from "@/components/admin/ImagePicker";
import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, ApiClientError } from "@/lib/api";
import { audioStatus, publishProblems } from "@/lib/devotional-rules";
import { formatDateTime, isoToIstInput, istInputToIso } from "@/lib/format";
import { slugify } from "@/lib/slug";
import {
  AUDIO_LICENCES, DEVOTIONAL_LANGUAGES, DEVOTIONAL_TYPES, devotionalHref, devotionalInputSchema, devotionalLangCode, emptyDevotional, type DevotionalInput,
} from "@/lib/validation/devotional";
import type { AdminDevotional } from "@/server/services/devotional";
import type { z } from "zod";

type FormValues = z.input<typeof devotionalInputSchema>;

const toDefaults = (v: AdminDevotional): FormValues => ({
  title: v.title, slug: v.slug, type: v.type, deity: v.deity, language: v.language, lyrics: v.lyrics, transliteration: v.transliteration, meaning: v.meaning, summary: v.summary,
  audioUrl: v.audioUrl, audioDurationSeconds: v.audioDurationSeconds, rights: v.rights, relatedAarti: v.relatedAarti, relatedVidhi: v.relatedVidhi, relatedProducts: v.relatedProducts,
  tags: v.tags, coverImageUrl: v.coverImageUrl, coverImageAlt: v.coverImageAlt, reviewer: v.reviewer, reviewedAt: v.reviewedAt, seo: v.seo,
});

function Area({ id, label, rows, error, hint, ...rest }: { id: string; label: string; rows: number; error?: string; hint?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <textarea id={id} rows={rows} className="input h-auto py-2" aria-invalid={!!error} aria-describedby={error ? `${id}-err ${id}-hint` : `${id}-hint`} {...rest} />
      {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-err`} className="field-error">{error}</p>}
    </div>
  );
}

function CsvField({ name, label, hint, control, setValue, error, readOnly }: { name: "relatedProducts" | "relatedAarti" | "relatedVidhi" | "tags"; label: string; hint: string; control: Control<FormValues>; setValue: UseFormSetValue<FormValues>; error?: string; readOnly: boolean }) {
  const value = useWatch({ control, name }) as string[] | undefined;
  const [text, setText] = useState((value ?? []).join(", "));
  return (
    <Input label={label} hint={hint} value={text} readOnly={readOnly} error={error}
      onChange={(e) => { setText(e.target.value); setValue(name, e.target.value.split(",").map((s) => s.trim()).filter(Boolean), { shouldDirty: true }); }} />
  );
}

const STATUS_TEXT = {
  none: "No recording attached.", ok: "Rights are valid: the audio player is shown.", expiring: "Rights expire within 30 days. The audio is hidden automatically after that.",
  expired: "Rights have expired: the audio is hidden from the public page.", withdrawn: "Rights were withdrawn: the audio is hidden from the public page.", unlicensed: "Rights record is incomplete: the audio is hidden from the public page.",
} as const;

export default function DevotionalEditor({ item, canPublish, readOnly = false }: { item: AdminDevotional | null; canPublish: boolean; readOnly?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [meta, setMeta] = useState(item);
  const [slugTouched, setSlugTouched] = useState(!!item);
  const [formError, setFormError] = useState<string | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pickCover, setPickCover] = useState(false);

  const form = useForm<FormValues, unknown, DevotionalInput>({ resolver: zodResolver(devotionalInputSchema), defaultValues: item ? toDefaults(item) : (emptyDevotional as FormValues) });
  const { register, handleSubmit, control, setValue, setError, reset, formState: { errors, isSubmitting, isDirty } } = form;
  const coverUrl = useWatch({ control, name: "coverImageUrl" });
  const reviewedAt = useWatch({ control, name: "reviewedAt" });
  const audioUrl = useWatch({ control, name: "audioUrl" });
  const rights = useWatch({ control, name: "rights" });
  const language = useWatch({ control, name: "language" });
  const liveAudio = audioStatus(audioUrl, rights);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const titleReg = register("title", { onChange: (e) => { if (!slugTouched) setValue("slug", slugify(e.target.value), { shouldValidate: false }); } });
  const slugReg = register("slug", { onChange: () => setSlugTouched(true) });
  const locked = busy !== null || isSubmitting;

  async function onSubmit(values: DevotionalInput) {
    if (busy !== null) return;
    setFormError(null);
    try {
      if (item) {
        const saved = await api.patch<AdminDevotional>(`/admin/aarti-mantras/${item.id}`, { ...values, baseUpdatedAt: meta?.updatedAt ?? item.updatedAt });
        setMeta(saved); reset(toDefaults(saved)); toast("Saved"); router.refresh();
      } else {
        const created = await api.post<AdminDevotional>("/admin/aarti-mantras", values);
        toast("Created as draft"); router.replace(`/admin/aarti-mantras/${created.id}`);
      }
    } catch (e) {
      if (e instanceof ApiClientError) {
        if (e.fields) for (const [k, m] of Object.entries(e.fields)) setError(k as never, { message: m });
        setFormError(e.message);
      } else setFormError("Something went wrong. Try again.");
    }
  }

  async function publish(body: { action: "publish" | "unpublish" } | { action: "schedule"; publishAt: string }, ok: string) {
    if (!item || locked) return;
    setBusy(body.action);
    try { setMeta(await api.post<AdminDevotional>(`/admin/aarti-mantras/${item.id}/publish`, body)); toast(ok); router.refresh(); }
    catch (e) { toast(e instanceof ApiClientError ? e.fields?.publishAt ?? e.message : "Could not update publishing", "error"); }
    finally { setBusy(null); }
  }
  async function rotateToken() {
    if (!item || locked) return;
    setBusy("token");
    try { setMeta(await api.post<AdminDevotional>(`/admin/aarti-mantras/${item.id}/preview-token`)); toast("Preview link reset. The old link no longer works."); }
    catch (e) { toast(e instanceof ApiClientError ? e.message : "Could not reset link", "error"); } finally { setBusy(null); }
  }
  async function copyPreview() {
    if (!meta) return;
    try { await navigator.clipboard.writeText(`${location.origin}/preview/devotional/${meta.previewToken}`); toast("Preview link copied"); }
    catch { toast("Could not copy. Open the preview and copy the address instead.", "error"); }
  }
  async function doDelete() {
    if (!item || locked) return;
    setBusy("delete");
    try { await api.delete(`/admin/aarti-mantras/${item.id}`); toast("Deleted"); router.replace("/admin/aarti-mantras"); router.refresh(); }
    catch (e) { toast(e instanceof ApiClientError ? e.message : "Could not delete", "error"); setBusy(null); setConfirmDelete(false); }
  }

  const live = meta && (meta.status === "published" || (meta.status === "scheduled" && meta.publishAt && new Date(meta.publishAt) <= new Date()));
  const problems = meta ? publishProblems({ lyrics: meta.lyrics, reviewer: meta.reviewer, reviewedAt: meta.reviewedAt }) : {};
  const ready = Object.keys(problems).length === 0;
  const dateInput = (iso: string) => (iso ? isoToIstInput(iso).slice(0, 10) : "");
  const lyricsLang = devotionalLangCode(language ?? "sanskrit");

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid items-start gap-6 lg:grid-cols-3">
      <fieldset disabled={readOnly || isSubmitting} className="min-w-0 space-y-6 lg:col-span-2">
        {formError && <p role="alert" className="alert-error">{formError}</p>}

        <section className="card space-y-4 p-5" aria-labelledby="basics">
          <h2 id="basics" className="font-sans text-lg font-semibold">Basics</h2>
          <Input label="Title" error={errors.title?.message} {...titleReg} />
          <Input label="URL slug" hint="English lowercase letters, numbers and hyphens, e.g. ganesh-aarti. Aarti live at /aarti/<slug>; everything else at /mantras/<slug>." error={errors.slug?.message} {...slugReg} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Type" error={errors.type?.message} {...register("type")}>{DEVOTIONAL_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</Select>
            <Select label="Language of the text" error={errors.language?.message} {...register("language")}>{DEVOTIONAL_LANGUAGES.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}</Select>
            <Input label="Deity (optional)" error={errors.deity?.message} {...register("deity")} />
          </div>
          <Input label="Short description (optional)" hint="One or two sentences for cards and search results. Up to 500 characters." error={errors.summary?.message} {...register("summary")} />
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

        <section className="card space-y-4 p-5" aria-labelledby="text">
          <h2 id="text" className="font-sans text-lg font-semibold">Text</h2>
          <Area id="lyrics" label="Lyrics / text" rows={14} lang={lyricsLang} error={errors.lyrics?.message} hint="Type each line on its own line and leave a blank line between verses. Line breaks are kept exactly as written." {...register("lyrics")} />
          <Area id="transliteration" label="In English letters (optional)" rows={8} error={errors.transliteration?.message} hint="For people who cannot read the script." {...register("transliteration")} />
          <Area id="meaning" label="Meaning (optional)" rows={6} error={errors.meaning?.message} hint="Markdown: **bold**, - list." {...register("meaning")} />
        </section>

        <section className="card space-y-4 p-5" aria-labelledby="audio">
          <h2 id="audio" className="font-sans text-lg font-semibold">Audio and rights</h2>
          <p className="text-sm text-muted">Use only original, licensed or public-domain recordings. Traditional lyrics do not make a modern recording free to use. The player is shown only while the rights below are complete, not expired and not withdrawn.</p>
          <Input label="Audio file URL (optional)" placeholder="https://…" hint="A direct link to an MP3 or similar file you are allowed to host." error={errors.audioUrl?.message} {...register("audioUrl")} />
          {!!audioUrl && (
            <>
              <Input label="Length in seconds (optional)" inputMode="numeric" error={errors.audioDurationSeconds?.message} {...register("audioDurationSeconds", { setValueAs: (v) => (v === "" || v == null ? null : Number(v)) })} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Recorded or owned by" error={errors.rights?.source?.message} {...register("rights.source")} />
                <Select label="Permission" error={errors.rights?.licence?.message} {...register("rights.licence")}><option value="">Choose…</option>{AUDIO_LICENCES.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}</Select>
                <Input label={rights?.licence === "licensed" ? "Licence reference" : "Licence reference (optional)"} hint="Agreement number, email thread or URL." error={errors.rights?.reference?.message} {...register("rights.reference")} />
                <Input label="Permission ends on (optional)" type="date" value={dateInput(rights?.expiresAt ?? "")} error={errors.rights?.expiresAt?.message}
                  onChange={(e) => setValue("rights.expiresAt", e.target.value ? istInputToIso(`${e.target.value}T23:59`) : "", { shouldDirty: true, shouldValidate: true })} />
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-saffron-600" {...register("rights.withdrawn")} /> The rights holder has withdrawn permission (hide the audio now)</label>
              <p role="status" className={`rounded-md p-3 text-sm ${liveAudio === "ok" ? "bg-sandal-100" : "bg-saffron-100 text-saffron-900"}`}>{STATUS_TEXT[liveAudio]}</p>
            </>
          )}
        </section>

        <section className="card space-y-4 p-5" aria-labelledby="links">
          <h2 id="links" className="font-sans text-lg font-semibold">Links and tags</h2>
          <CsvField name="relatedAarti" label="Related aarti and mantras (slugs)" hint="Comma-separated, e.g. ganesh-aarti, hanuman-chalisa." control={control} setValue={setValue} error={errors.relatedAarti?.message} readOnly={readOnly} />
          <CsvField name="relatedVidhi" label="Related Pooja Vidhi guides (slugs)" hint="Comma-separated slugs of guides." control={control} setValue={setValue} error={errors.relatedVidhi?.message} readOnly={readOnly} />
          <CsvField name="relatedProducts" label="Related products (shop slugs)" hint="Comma-separated, e.g. brass-diya." control={control} setValue={setValue} error={errors.relatedProducts?.message} readOnly={readOnly} />
          <CsvField name="tags" label="Tags" hint="Comma-separated, e.g. diwali, morning." control={control} setValue={setValue} error={errors.tags?.message} readOnly={readOnly} />
        </section>

        <section className="card space-y-4 p-5" aria-labelledby="review">
          <h2 id="review" className="font-sans text-lg font-semibold">Review</h2>
          <p className="text-sm text-muted">Religious text must be checked for accuracy and tradition before it is published. Name who did and when.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Reviewed by" error={errors.reviewer?.message} {...register("reviewer")} />
            <Input label="Date reviewed" type="date" value={dateInput(reviewedAt ?? "")} error={errors.reviewedAt?.message}
              onChange={(e) => setValue("reviewedAt", e.target.value ? istInputToIso(`${e.target.value}T00:00`) : "", { shouldDirty: true, shouldValidate: true })} />
          </div>
        </section>

        <section className="card space-y-4 p-5" aria-labelledby="seo">
          <h2 id="seo" className="font-sans text-lg font-semibold">SEO</h2>
          <Input label="SEO title" hint="Defaults to the title. Up to 70 characters." error={errors.seo?.title?.message} {...register("seo.title")} />
          <Area id="seo-desc" label="Meta description" rows={2} error={errors.seo?.description?.message} hint="Defaults to the short description." {...register("seo.description")} />
          <Input label="Canonical URL" hint="Leave blank to use this page's own URL." error={errors.seo?.canonical?.message} {...register("seo.canonical")} />
          <Input label="Social share image URL" placeholder="https://…" error={errors.seo?.ogImage?.message} {...register("seo.ogImage")} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-saffron-600" {...register("seo.noindex")} /> Hide this page from search engines</label>
        </section>
      </fieldset>

      <aside className="space-y-6 lg:sticky lg:top-20" aria-label="Actions">
        {!readOnly && (
          <div className="card space-y-3 p-5">
            <Button type="submit" loading={isSubmitting} disabled={busy !== null} className="w-full">{item ? "Save changes" : "Create"}</Button>
            {isDirty && item && <p className="text-xs text-warning">You have unsaved changes.</p>}
          </div>
        )}

        {item && meta && (
          <div className="card space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-sans text-lg font-semibold">Publishing</h2>
              <span className={live ? "badge-success" : meta.status === "scheduled" ? "badge-primary" : "badge-muted"}>{live ? "Live" : meta.status === "scheduled" ? "Scheduled" : "Draft"}</span>
            </div>
            {meta.status === "scheduled" && <p className="text-sm text-muted">Goes live {formatDateTime(meta.publishAt)}</p>}
            {meta.status === "published" && <p className="text-sm text-muted">Published {formatDateTime(meta.publishedAt)}</p>}
            {live && <Link href={devotionalHref(meta.type, meta.slug)} target="_blank" className="text-sm text-primary underline underline-offset-2">View live page ↗</Link>}
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
                  {meta.status !== "published" && <Button size="sm" disabled={isDirty || locked || !ready} loading={busy === "publish"} onClick={() => publish({ action: "publish" }, "Published")}>Publish now</Button>}
                  {meta.status !== "draft" && <Button size="sm" variant="outline" disabled={isDirty || locked} loading={busy === "unpublish"} onClick={() => publish({ action: "unpublish" }, "Moved to draft")}>Unpublish</Button>}
                </div>
                {live ? <p className="text-xs text-muted">To schedule a new go-live time, unpublish first.</p> : (
                  <div>
                    <label htmlFor="schedule-at" className="label">Schedule (India Standard Time)</label>
                    <input id="schedule-at" type="datetime-local" className="input" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
                    <Button size="sm" variant="outline" className="mt-2" disabled={isDirty || !scheduleAt || locked || !ready} loading={busy === "schedule"} onClick={() => publish({ action: "schedule", publishAt: istInputToIso(scheduleAt) }, "Scheduled")}>Schedule</Button>
                  </div>
                )}
              </>
            ) : <p className="text-xs text-muted">You do not have permission to change publishing.</p>}
          </div>
        )}

        {item && meta && (
          <div className="card space-y-3 p-5">
            <h2 className="font-sans text-lg font-semibold">Preview</h2>
            <p className="text-xs text-muted">Anyone with this link can see the saved page, even as a draft. Reset it to revoke access.</p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/preview/devotional/${meta.previewToken}`} target="_blank" className="btn-outline btn-sm">Open preview ↗</Link>
              <Button size="sm" variant="ghost" onClick={copyPreview}>Copy link</Button>
              {!readOnly && <Button size="sm" variant="ghost" disabled={locked} loading={busy === "token"} onClick={rotateToken}>Reset link</Button>}
            </div>
          </div>
        )}

        {item && !readOnly && <div className="card p-5"><Button variant="danger" size="sm" disabled={locked} onClick={() => setConfirmDelete(true)}>Delete</Button></div>}
      </aside>

      <ImagePicker open={pickCover} onClose={() => setPickCover(false)} onPick={(url, alt) => { setValue("coverImageUrl", url, { shouldDirty: true, shouldValidate: true }); setValue("coverImageAlt", alt, { shouldDirty: true, shouldValidate: true }); }} />

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this item?">
        <p className="text-sm text-muted">“{item?.title}” will be removed permanently and its URL will stop working.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button variant="danger" loading={busy === "delete"} disabled={locked && busy !== "delete"} onClick={doDelete}>Delete</Button>
        </div>
      </Modal>
    </form>
  );
}
