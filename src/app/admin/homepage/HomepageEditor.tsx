"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ImagePicker from "@/components/admin/ImagePicker";
import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { api, ApiClientError } from "@/lib/api";
import { isoToIstInput, istInputToIso } from "@/lib/format";
import {
  MAX_RAILS, MAX_SECTIONS, SECTION_LABEL, SECTION_TYPES, defaultData, updateHomepageSchema,
  type HomeSection, type SectionType,
} from "@/lib/validation/homepage";
import type { AdminHomepage } from "@/server/services/homepage";

type Cat = { id: string; name: string; path: string; level: number };
type Errs = Record<string, string>;
type Data = Record<string, unknown>;
type Field =
  | { key: string; label: string; kind: "text" | "textarea" | "number" | "datetime" | "markdown"; hint?: string; max?: number }
  | { key: string; label: string; kind: "image"; altKey: string }
  | { key: string; label: string; kind: "select"; options: [string, string][] }
  | { key: string; label: string; kind: "categoryPath" };
type Spec = { fields: Field[]; list?: { key: string; label: string; item: string; fields: Field[]; max: number; blank: Data } };

const LINK_HINT = "A path like /about or a full https:// URL";
const text = (key: string, label: string, max?: number): Field => ({ key, label, kind: "text", max });
const RAIL: Spec = { fields: [text("heading", "Heading", 80), { key: "category", label: "Only from category", kind: "categoryPath" }, { key: "limit", label: "How many products (1–12)", kind: "number" }] };
const SPECS: Record<SectionType, Spec> = {
  hero: { fields: [text("heading", "Heading", 120), { key: "subheading", label: "Subheading", kind: "textarea", max: 300 }, { key: "imageUrl", label: "Image", kind: "image", altKey: "imageAlt" }, text("imageAlt", "Image description (alt text)", 200),
    text("ctaLabel", "Button label", 40), { key: "ctaUrl", label: "Button link", kind: "text", hint: LINK_HINT }, text("secondaryCtaLabel", "Second button label", 40), { key: "secondaryCtaUrl", label: "Second button link", kind: "text", hint: LINK_HINT }] },
  banner: { fields: [], list: { key: "items", label: "Banners", item: "Banner", max: 4, blank: { imageUrl: "", imageAlt: "", heading: "", text: "", linkUrl: "" },
    fields: [{ key: "imageUrl", label: "Image", kind: "image", altKey: "imageAlt" }, text("imageAlt", "Image description (alt text)", 200), text("heading", "Heading", 100), text("text", "Text", 200), { key: "linkUrl", label: "Link", kind: "text", hint: LINK_HINT }] } },
  featuredCategories: { fields: [text("heading", "Heading", 80)] }, // categories handled specially
  featuredProducts: RAIL, latestProducts: RAIL, bestSellers: RAIL,
  richText: { fields: [{ key: "markdown", label: "Content (Markdown)", kind: "markdown", max: 20000 }] },
  imageText: { fields: [text("heading", "Heading", 120), { key: "markdown", label: "Text (Markdown)", kind: "markdown", max: 5000 }, { key: "imageUrl", label: "Image", kind: "image", altKey: "imageAlt" }, text("imageAlt", "Image description (alt text)", 200),
    { key: "imagePosition", label: "Image position", kind: "select", options: [["left", "Left"], ["right", "Right"]] }, text("ctaLabel", "Button label", 40), { key: "ctaUrl", label: "Button link", kind: "text", hint: LINK_HINT }] },
  testimonials: { fields: [text("heading", "Heading", 80)], list: { key: "items", label: "Testimonials", item: "Testimonial", max: 8, blank: { quote: "", author: "", role: "" },
    fields: [{ key: "quote", label: "Quote", kind: "textarea", max: 400 }, text("author", "Name", 80), text("role", "Role / place", 80)] } },
  offer: { fields: [text("heading", "Heading", 100), text("text", "Text", 300), text("code", "Offer code", 30), text("ctaLabel", "Button label", 40), { key: "ctaUrl", label: "Button link", kind: "text", hint: LINK_HINT },
    { key: "expiresAt", label: "Hide after (IST)", kind: "datetime", hint: "Optional; the offer disappears by itself" }] },
  latestPosts: { fields: [text("heading", "Heading", 80), { key: "kind", label: "Show", kind: "select", options: [["blog", "Blog posts"], ["guide", "Guides"], ["all", "Blog posts and guides"]] },
    { key: "limit", label: "How many (1–12)", kind: "number" }] },
  custom: { fields: [{ key: "markdown", label: "Content (Markdown)", kind: "markdown", max: 20000 }, { key: "tone", label: "Background", kind: "select", options: [["plain", "Plain"], ["soft", "Soft sand"], ["accent", "Saffron tint"]] }] },
};

const newId = () => crypto.randomUUID().slice(0, 12);
const swap = <T,>(a: T[], i: number, d: -1 | 1): T[] => { const j = i + d; if (j < 0 || j >= a.length) return a; const c = [...a]; [c[i], c[j]] = [c[j], c[i]]; return c; };
const mini = "btn-ghost btn-sm px-2 disabled:opacity-40";

function FieldInput({ f, data, set, err, idp, cats, pick }: { f: Field; data: Data; set: (patch: Data) => void; err?: string; idp: string; cats: Cat[]; pick: (altKey: string, key: string) => void }) {
  const v = data[f.key];
  const id = `${idp}-${f.key}`;
  const [now] = useState(() => Date.now()); // "has this time passed" is evaluated when the editor opens
  switch (f.kind) {
    case "textarea": case "markdown":
      return (
        <div className="sm:col-span-2">
          <label htmlFor={id} className="label">{f.label}</label>
          <textarea id={id} rows={f.kind === "markdown" ? 6 : 3} maxLength={f.max} className={`input h-auto py-2 ${f.kind === "markdown" ? "font-mono text-sm" : ""}`} aria-invalid={!!err} aria-describedby={err ? `${id}-err` : undefined} value={String(v ?? "")} onChange={(e) => set({ [f.key]: e.target.value })} />
          {err && <p id={`${id}-err`} className="field-error">{err}</p>}
        </div>
      );
    case "number":
      return <Input label={f.label} type="number" min={1} max={12} value={String(v ?? "")} error={err} onChange={(e) => set({ [f.key]: Math.trunc(Number(e.target.value) || 0) })} />;
    case "datetime":
      return <Input label={f.label} type="datetime-local" hint={v && new Date(String(v)).getTime() <= now ? "This time has passed, so the offer is currently hidden." : f.hint} value={v ? isoToIstInput(String(v)) : ""} error={err} onChange={(e) => set({ [f.key]: e.target.value ? istInputToIso(e.target.value) : "" })} />;
    case "select":
      return <Select label={f.label} value={String(v ?? "")} error={err} onChange={(e) => set({ [f.key]: e.target.value })}>{f.options.map(([val, l]) => <option key={val} value={val}>{l}</option>)}</Select>;
    case "categoryPath":
      return (
        <Select label={f.label} value={String(v ?? "")} error={err} onChange={(e) => set({ [f.key]: e.target.value })}>
          <option value="">Any category</option>
          {cats.map((c) => <option key={c.id} value={c.path}>{"— ".repeat(c.level - 1)}{c.name}</option>)}
        </Select>
      );
    case "image":
      return (
        <div className="sm:col-span-2 space-y-2">
          <Input label={f.label + " URL"} value={String(v ?? "")} error={err} placeholder="https://…" onChange={(e) => set({ [f.key]: e.target.value })} />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => pick(f.altKey, f.key)}>Choose from library</Button>
            {!!v && <Button variant="ghost" size="sm" onClick={() => set({ [f.key]: "", [f.altKey]: "" })}>Remove image</Button>}
          </div>
        </div>
      );
    default:
      return <Input label={f.label} value={String(v ?? "")} error={err} maxLength={f.max} hint={f.hint} onChange={(e) => set({ [f.key]: e.target.value })} />;
  }
}

/** One draggable section row. The ⠿ handle is the only drag activator, so inputs inside stay usable. */
function SortableSection({ id, label, children }: { id: string; label: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <button ref={setActivatorNodeRef} type="button" className="btn-ghost btn-sm cursor-grab touch-none px-2 text-lg leading-none active:cursor-grabbing"
      aria-label={`Drag to reorder ${label} (Space to lift, arrow keys to move)`} {...attributes} {...listeners}>⠿</button>
  );
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`rounded-xl border bg-surface ${isDragging ? "relative z-10 border-primary shadow-elev-3" : "border-border"}`}>
      {children(handle)}
    </li>
  );
}

export default function HomepageEditor({ initial, categories }: { initial: AdminHomepage; categories: Cat[] }) {
  const router = useRouter();
  const toast = useToast();
  const [version, setVersion] = useState(initial.updatedAt);
  const [sections, setSections] = useState<HomeSection[]>(initial.sections);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [errs, setErrs] = useState<Errs>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  // Dirty = edits made since the last saved revision. A save records the revision it sent, so anything typed while
  // the request was in flight stays unsaved (and keeps the leave-page warning) instead of being marked clean.
  const [edits, setEdits] = useState(0);
  const [savedRev, setSavedRev] = useState(0);
  const dirty = edits !== savedRev;
  const [addType, setAddType] = useState<SectionType>("hero");
  const [picker, setPicker] = useState<{ i: number; list?: [string, number]; altKey: string; key: string } | null>(null);
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const commit = (next: HomeSection[]) => { setSections(next); setEdits((n) => n + 1); setErrs({}); setGeneral(null); }; // errors are keyed by position, so they are cleared whenever the list changes
  const patchData = (i: number, patch: Data) => commit(sections.map((s, n) => (n === i ? ({ ...s, data: { ...s.data, ...patch } } as HomeSection) : s)));
  const patchSection = (i: number, patch: Partial<HomeSection>) => commit(sections.map((s, n) => (n === i ? ({ ...s, ...patch } as HomeSection) : s)));
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const rails = sections.filter((s) => ["featuredProducts", "latestProducts", "bestSellers"].includes(s.type)).length;
  const railFull = ["featuredProducts", "latestProducts", "bestSellers"].includes(addType) && rails >= MAX_RAILS;
  const heroFull = addType === "hero" && sections.some((s) => s.type === "hero");

  function add() {
    const s = { id: newId(), type: addType, enabled: true, data: structuredClone(defaultData[addType]) } as HomeSection;
    commit([...sections, s]);
    setOpen((o) => new Set(o).add(s.id));
    setAnnounce(`${SECTION_LABEL[addType]} section added`);
  }
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const dndId = useId(); // stable across SSR and hydration (dnd-kit's own counter is not)
  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = sections.findIndex((x) => x.id === e.active.id);
    const to = sections.findIndex((x) => x.id === e.over!.id);
    if (from < 0 || to < 0) return;
    commit(arrayMove(sections, from, to));
    setAnnounce(`${SECTION_LABEL[sections[from].type]} moved to position ${to + 1} of ${sections.length}`);
  }
  function move(i: number, d: -1 | 1) {
    commit(swap(sections, i, d));
    setAnnounce(`${SECTION_LABEL[sections[i].type]} moved to position ${i + d + 1} of ${sections.length}`);
  }

  async function save() {
    setGeneral(null); setConflict(false);
    const body = { sections, baseUpdatedAt: version };
    const parsed = updateHomepageSchema.safeParse(body);
    if (!parsed.success) {
      const m: Errs = {};
      for (const iss of parsed.error.issues) m[iss.path.join(".")] ??= iss.message;
      setErrs(m);
      // Open every section that has an error (they can still be collapsed afterwards).
      setOpen((o) => { const n = new Set(o); sections.forEach((sec, idx) => { if (Object.keys(m).some((k) => k.startsWith(`sections.${idx}.`))) n.add(sec.id); }); return n; });
      const flat = Object.keys(m).find((k) => !/^sections\.\d+\./.test(k));
      setGeneral(flat ? m[flat] : "Fix the highlighted fields.");
      return;
    }
    setErrs({}); setBusy(true);
    const rev = edits;
    try {
      const saved = await api.put<AdminHomepage>("/admin/homepage", body);
      setVersion(saved.updatedAt); setSavedRev(rev); toast("Homepage saved. It is live on the storefront."); router.refresh();
    } catch (e) {
      setConflict(e instanceof ApiClientError && e.status === 409);
      setGeneral(e instanceof ApiClientError ? e.message : "Could not save the homepage");
    } finally { setBusy(false); }
  }

  const sectionErr = (i: number, path: string) => errs[`sections.${i}.data.${path}`];
  const summary = (s: HomeSection) => { const d = s.data as Data; return String(d.heading ?? d.markdown ?? "").slice(0, 60) || "No heading yet"; };

  return (
    <div className="space-y-4">
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{sections.length} section{sections.length === 1 ? "" : "s"} (max {MAX_SECTIONS}). Hidden sections stay saved but are not shown.</p>
        <Button onClick={save} loading={busy} disabled={!dirty}>Save homepage</Button>
      </div>
      {general && (
        <div role="alert" className="alert-error flex flex-wrap items-center justify-between gap-3">
          <p>{general}</p>
          {conflict && <button type="button" className="btn-outline btn-sm" onClick={() => window.location.reload()}>Reload latest (discards your edits)</button>}
        </div>
      )}

      {sections.length === 0 && <div className="card px-6 py-10 text-center text-sm text-muted hover:shadow-elev-1">No sections yet. Add a hero to get started; until then visitors see the default placeholder.</div>}
      {sections.length > 1 && <p className="text-xs text-muted">Drag the ⠿ handle (or use ↑ ↓) to reorder sections. Save to publish the new order.</p>}
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={sections.map((x) => x.id)} strategy={verticalListSortingStrategy}>
      <ol className="space-y-3">
        {sections.map((s, i) => {
          const isOpen = open.has(s.id);
          const spec = SPECS[s.type];
          const data = s.data as Data;
          const idp = `s-${s.id}`;
          const doPick = (altKey: string, key: string, listIdx?: number) => setPicker({ i, altKey, key, list: listIdx === undefined ? undefined : [spec.list!.key, listIdx] });
          return (
            <SortableSection key={s.id} id={s.id} label={`${SECTION_LABEL[s.type]} (section ${i + 1})`}>{(handle) => (<>
              <div className="flex flex-wrap items-center gap-2 p-3">
                {handle}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${s.enabled ? "" : "text-muted line-through"}`}>{SECTION_LABEL[s.type]}</p>
                  <p className="truncate text-xs text-muted">{summary(s)}</p>
                </div>
                {!s.enabled && <span className="badge-muted">Hidden</span>}
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.enabled} onChange={(e) => patchSection(i, { enabled: e.target.checked })} aria-label={`Visible: ${SECTION_LABEL[s.type]} section ${i + 1}`} /> Visible</label>
                <button type="button" className={mini} disabled={i === 0} aria-label={`Move ${SECTION_LABEL[s.type]} (section ${i + 1}) up`} onClick={() => move(i, -1)}>↑</button>
                <button type="button" className={mini} disabled={i === sections.length - 1} aria-label={`Move ${SECTION_LABEL[s.type]} (section ${i + 1}) down`} onClick={() => move(i, 1)}>↓</button>
                <button type="button" className="btn-outline btn-sm" aria-expanded={isOpen} aria-controls={isOpen ? `${idp}-body` : undefined} onClick={() => toggle(s.id)}>{isOpen ? "Done" : "Edit"}</button>
                <button type="button" className="btn-danger btn-sm" aria-label={`Remove ${SECTION_LABEL[s.type]} (section ${i + 1})`} onClick={() => { commit(sections.filter((_, n) => n !== i)); setAnnounce(`${SECTION_LABEL[s.type]} section removed`); }}>Remove</button>
              </div>
              {isOpen && (
                <div id={`${idp}-body`} className="space-y-4 border-t border-border p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {spec.fields.map((f) => <FieldInput key={f.key} f={f} data={data} idp={idp} cats={categories} err={sectionErr(i, f.key)} set={(p) => patchData(i, p)} pick={(a, k) => doPick(a, k)} />)}
                  </div>

                  {s.type === "featuredCategories" && (() => {
                    const ids = (data.categoryIds as string[]) ?? [];
                    const set = (next: string[]) => patchData(i, { categoryIds: next });
                    return (
                      <div className="space-y-2">
                        <p className="label">Categories (shown in this order)</p>
                        <ul className="space-y-1">
                          {ids.map((cid, n) => (
                            <li key={cid} className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-sm">
                              <span className="flex-1">{categories.find((c) => c.id === cid)?.name ?? "Deleted category (will be hidden)"}</span>
                              <button type="button" className={mini} disabled={n === 0} aria-label={`Move category ${n + 1} up`} onClick={() => set(swap(ids, n, -1))}>↑</button>
                              <button type="button" className={mini} disabled={n === ids.length - 1} aria-label={`Move category ${n + 1} down`} onClick={() => set(swap(ids, n, 1))}>↓</button>
                              <button type="button" className="btn-ghost btn-sm" aria-label={`Remove category ${n + 1}`} onClick={() => set(ids.filter((_, m) => m !== n))}>Remove</button>
                            </li>
                          ))}
                        </ul>
                        <Select label="Add a category" value="" disabled={ids.length >= 8} onChange={(e) => { if (e.target.value) set([...ids, e.target.value]); }}>
                          <option value="">Choose…</option>
                          {categories.filter((c) => !ids.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{"— ".repeat(c.level - 1)}{c.name}</option>)}
                        </Select>
                        {sectionErr(i, "categoryIds") && <p className="field-error">{sectionErr(i, "categoryIds")}</p>}
                      </div>
                    );
                  })()}

                  {spec.list && (() => {
                    const L = spec.list;
                    const items = (data[L.key] as Data[]) ?? [];
                    const setItems = (next: Data[]) => patchData(i, { [L.key]: next });
                    return (
                      <div className="space-y-3">
                        <p className="label">{L.label}</p>
                        {items.map((it, n) => (
                          <div key={n} className="space-y-3 rounded-lg border border-border p-3">
                            <div className="grid gap-4 sm:grid-cols-2">
                              {L.fields.map((f) => (
                                <FieldInput key={f.key} f={f} data={it} idp={`${idp}-${n}`} cats={categories} err={sectionErr(i, `${L.key}.${n}.${f.key}`)}
                                  set={(p) => setItems(items.map((x, m) => (m === n ? { ...x, ...p } : x)))} pick={(a, k) => doPick(a, k, n)} />
                              ))}
                            </div>
                            <div className="flex gap-1">
                              <button type="button" className={mini} disabled={n === 0} aria-label={`Move ${L.item} ${n + 1} up`} onClick={() => setItems(swap(items, n, -1))}>↑</button>
                              <button type="button" className={mini} disabled={n === items.length - 1} aria-label={`Move ${L.item} ${n + 1} down`} onClick={() => setItems(swap(items, n, 1))}>↓</button>
                              <button type="button" className="btn-danger btn-sm" aria-label={`Remove ${L.item} ${n + 1}`} onClick={() => setItems(items.filter((_, m) => m !== n))}>Remove</button>
                            </div>
                          </div>
                        ))}
                        {sectionErr(i, L.key) && <p className="field-error">{sectionErr(i, L.key)}</p>}
                        <Button variant="outline" size="sm" disabled={items.length >= L.max} onClick={() => setItems([...items, { ...L.blank }])}>Add {L.item.toLowerCase()}</Button>
                      </div>
                    );
                  })()}
                </div>
              )}
            </>)}</SortableSection>
          );
        })}
      </ol>
      </SortableContext>
      </DndContext>
      {errs.sections && <p className="field-error">{errs.sections}</p>}

      <div className="card flex flex-wrap items-end gap-3 p-4 hover:shadow-elev-1">
        <div className="min-w-56">
          <Select label="Add a section" value={addType} onChange={(e) => setAddType(e.target.value as SectionType)}>
            {SECTION_TYPES.map((t) => <option key={t} value={t}>{SECTION_LABEL[t]}</option>)}
          </Select>
        </div>
        <Button onClick={add} disabled={sections.length >= MAX_SECTIONS || railFull || heroFull}>Add section</Button>
        {railFull && <p className="text-sm text-muted">At most {MAX_RAILS} product sections.</p>}
        {heroFull && <p className="text-sm text-muted">There can be only one hero section.</p>}
      </div>

      <ImagePicker open={!!picker} onClose={() => setPicker(null)} onPick={(url, alt) => {
        if (!picker) return;
        const { i, list, key, altKey } = picker;
        if (list) {
          const items = ((sections[i].data as Data)[list[0]] as Data[]).map((x, m) => (m === list[1] ? { ...x, [key]: url, [altKey]: alt } : x));
          patchData(i, { [list[0]]: items });
        } else patchData(i, { [key]: url, [altKey]: alt });
      }} />
    </div>
  );
}
