"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { api, ApiClientError } from "@/lib/api";
import { add, canIndent, canOutdent, flatten, indent, locate, move, newItem, outdent, remove, reorder, update } from "@/lib/menu-tree";
import { MENU_DEPTH, updateMenuSchema, type MenuItemInput } from "@/lib/validation/menus";
import type { AdminMenu } from "@/server/services/menus";

type LinkPage = { id: string; title: string; slug: string; live: boolean };
type Errors = Record<string, Partial<Record<"label" | "ref" | "url", string>>>;

const newId = () => crypto.randomUUID().slice(0, 12);

/** Zod issue paths like ["items", 0, "children", 1, "label"] -> { [itemId]: { label: msg } }. */
function mapErrors(items: MenuItemInput[], issues: { path: PropertyKey[]; message: string }[]): { byItem: Errors; general?: string } {
  const byItem: Errors = {};
  let general: string | undefined;
  for (const issue of issues) {
    let list = items;
    let item: MenuItemInput | undefined;
    const p = issue.path.slice(1); // drop "items"
    let i = 0;
    while (i < p.length && typeof p[i] === "number") {
      item = list[p[i] as number];
      if (!item) break;
      list = item.children;
      i += 2; // skip "children"
    }
    const key = (typeof p[p.length - 1] === "string" ? p[p.length - 1] : undefined) as "label" | "ref" | "url" | undefined;
    if (item && key && ["label", "ref", "url"].includes(key)) (byItem[item.id] ??= {})[key] ??= issue.message;
    else general ??= issue.message;
  }
  return { byItem, general };
}

type RowProps = {
  item: MenuItemInput; items: MenuItemInput[]; pages: LinkPage[]; errors: Errors; expanded: Set<string>; readOnly: boolean;
  toggle: (id: string) => void; apply: (next: MenuItemInput[], focusKey?: string) => void;
};

function Row({ item, items, pages, errors, expanded, readOnly, toggle, apply }: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: readOnly });
  const at = locate(items, item.id)!;
  const err = errors[item.id] ?? {};
  const open = expanded.has(item.id) || Object.keys(err).length > 0;
  const page = pages.find((p) => p.id === item.ref);
  const summary = item.type === "page" ? (page ? `/${page.slug}${page.live ? "" : " (not published)"}` : "Choose a page") : item.url || "No link";
  const patch = (p: Partial<MenuItemInput>) => apply(update(items, item.id, p));
  const btn = "btn-ghost btn-sm px-2 disabled:opacity-40";

  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? "relative z-10 opacity-80" : ""}>
      <div className="rounded-lg border border-border bg-surface">
        <div className="flex flex-wrap items-center gap-1 p-2">
          {!readOnly && (
            <button ref={setActivatorNodeRef} type="button" className="btn-ghost btn-sm cursor-grab px-2 touch-none" aria-label={`Reorder ${item.label || "item"} (Space to lift, arrow keys to move)`} {...attributes} {...listeners}>⠿</button>
          )}
          <div className="min-w-0 flex-1 px-1">
            <p className={`truncate text-sm font-medium ${item.enabled ? "" : "text-muted line-through"}`}>{item.label || <span className="text-muted">Untitled item</span>}</p>
            <p className="truncate text-xs text-muted">{summary}</p>
          </div>
          {!item.enabled && <span className="badge-muted">Hidden</span>}
          {item.enabled && !item.showOnDesktop && <span className="badge-muted">Mobile only</span>}
          {item.enabled && !item.showOnMobile && <span className="badge-muted">Desktop only</span>}
          {!readOnly && (
            <>
              <button type="button" className={btn} data-act={`${item.id}:up`} disabled={at.index === 0} aria-label={`Move ${item.label || "item"} up`} onClick={() => apply(move(items, item.id, -1), `${item.id}:up`)}>↑</button>
              <button type="button" className={btn} data-act={`${item.id}:down`} disabled={at.index === at.siblings.length - 1} aria-label={`Move ${item.label || "item"} down`} onClick={() => apply(move(items, item.id, 1), `${item.id}:down`)}>↓</button>
              <button type="button" className={btn} data-act={`${item.id}:out`} disabled={!canOutdent(items, item.id)} aria-label={`Move ${item.label || "item"} out one level`} onClick={() => apply(outdent(items, item.id), `${item.id}:out`)}>←</button>
              <button type="button" className={btn} data-act={`${item.id}:in`} disabled={!canIndent(items, item.id)} aria-label={`Nest ${item.label || "item"} under the item above`} onClick={() => apply(indent(items, item.id), `${item.id}:in`)}>→</button>
            </>
          )}
          <button type="button" data-act={`${item.id}:edit`} className="btn-outline btn-sm" aria-expanded={open} onClick={() => toggle(item.id)}>{open ? "Done" : readOnly ? "View" : "Edit"}</button>
        </div>

        {open && (
          <fieldset disabled={readOnly} className="grid gap-3 border-t border-border p-3 sm:grid-cols-2">
            <Input label="Label" value={item.label} error={err.label} maxLength={60} onChange={(e) => patch({ label: e.target.value })} />
            <Select label="Links to" value={item.type} onChange={(e) => patch({ type: e.target.value as MenuItemInput["type"] })}>
              <option value="page">A page</option>
              <option value="external">Custom link</option>
            </Select>
            {item.type === "page" ? (
              <Select label="Page" value={item.ref ?? ""} error={err.ref} onChange={(e) => patch({ ref: e.target.value || undefined })}>
                <option value="">Choose a page…</option>
                {pages.map((p) => <option key={p.id} value={p.id}>{p.title} (/{p.slug}){p.live ? "" : " — not published"}</option>)}
              </Select>
            ) : (
              <Input label="URL" value={item.url ?? ""} error={err.url} placeholder="/about or https://…" onChange={(e) => patch({ url: e.target.value })} />
            )}
            <div className="flex flex-wrap items-end gap-x-5 gap-y-2 pb-2 text-sm">
              {([["enabled", "Visible"], ["showOnDesktop", "Desktop"], ["showOnMobile", "Mobile"], ["openInNewTab", "New tab"]] as const).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="checkbox" checked={item[k]} onChange={(e) => patch({ [k]: e.target.checked })} /> {l}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              {at.depth < MENU_DEPTH && (
                <Button variant="outline" size="sm" onClick={() => { const c = newItem(newId()); apply(add(items, item.id, c), c.id); toggle(c.id); }}>Add child item</Button>
              )}
              <Button variant="danger" size="sm" onClick={() => apply(remove(items, item.id))}>Remove{item.children.length ? " (and children)" : ""}</Button>
            </div>
          </fieldset>
        )}
      </div>
      {item.children.length > 0 && (
        <div className="ml-6 mt-2 border-l-2 border-sandal-300 pl-3">
          <Level list={item.children} {...{ items, pages, errors, expanded, readOnly, toggle, apply }} />
        </div>
      )}
    </li>
  );
}

function Level({ list, ...rest }: { list: MenuItemInput[] } & Omit<RowProps, "item">) {
  return (
    <SortableContext items={list.map((i) => i.id)} strategy={verticalListSortingStrategy}>
      <ul className="space-y-2">{list.map((i) => <Row key={i.id} item={i} {...rest} />)}</ul>
    </SortableContext>
  );
}

export default function MenuEditor({ menu, pages, pagesTruncated = false, readOnly = false }: { menu: AdminMenu; pages: LinkPage[]; pagesTruncated?: boolean; readOnly?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [meta, setMeta] = useState(menu);
  const [name, setName] = useState(menu.name);
  const [items, setItems] = useState<MenuItemInput[]>(menu.items);
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Errors>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const pendingFocus = useRef<string | null>(null);
  const edits = useRef(0); // bumped on every change; a save only clears "dirty" if nothing changed while it was in flight

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const apply = (next: MenuItemInput[], focusKey?: string) => { setItems(next); setDirty(true); edits.current++; if (focusKey) pendingFocus.current = focusKey; };
  // Rows remount when an item changes level, so focus is restored to the same action (or the row's Edit button
  // if that action is no longer available) after React has rendered the new tree.
  useEffect(() => {
    const key = pendingFocus.current;
    if (!key) return;
    pendingFocus.current = null;
    const id = key.split(":")[0];
    (document.querySelector<HTMLButtonElement>(`[data-act="${key}"]:not(:disabled)`) ?? document.querySelector<HTMLButtonElement>(`[data-act="${id}:edit"]`))?.focus();
  }, [items]);
  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const onDragEnd = (e: DragEndEvent) => { if (e.over && e.active.id !== e.over.id) apply(reorder(items, String(e.active.id), String(e.over.id))); };

  async function save() {
    setGeneral(null);
    const body = { name, items, baseUpdatedAt: meta.updatedAt };
    const parsed = updateMenuSchema.safeParse(body);
    if (!parsed.success) {
      const m = mapErrors(items, parsed.error.issues);
      setErrors(m.byItem);
      setGeneral(m.general ?? (Object.keys(m.byItem).length ? "Fix the highlighted items." : "Check the menu name."));
      return;
    }
    setErrors({});
    setBusy(true);
    const rev = edits.current;
    try {
      const saved = await api.put<AdminMenu>(`/admin/menus/${menu.id}`, body);
      setMeta(saved);
      if (edits.current === rev) setDirty(false);
      toast("Menu saved. It is live on the storefront.");
      router.refresh();
    } catch (e) {
      setConflict(e instanceof ApiClientError && e.status === 409);
      setGeneral(e instanceof ApiClientError ? e.fields?.items ?? e.fields?.name ?? e.message : "Could not save the menu");
    } finally {
      setBusy(false);
    }
  }

  const total = flatten(items).length;
  return (
    <div className="space-y-4">
      <div className="card grid gap-4 p-4 hover:shadow-elev-1 sm:grid-cols-[1fr_auto] sm:items-end">
        <Input label="Menu name" value={name} readOnly={readOnly} onChange={(e) => { setName(e.target.value); setDirty(true); edits.current++; }} />
        {!readOnly && <Button onClick={save} loading={busy} disabled={!dirty}>Save menu</Button>}
      </div>
      {general && (
        <div role="alert" className="alert-error flex flex-wrap items-center justify-between gap-3">
          <p>{general}</p>
          {conflict && <button type="button" className="btn-outline btn-sm" onClick={() => window.location.reload()}>Reload latest (discards your edits)</button>}
        </div>
      )}
      {pagesTruncated && <p className="alert-error" role="status">Only the first {pages.length} pages (A–Z) can be chosen in the page picker. Use a custom link for others.</p>}
      <p className="text-sm text-muted">
        {total} item{total === 1 ? "" : "s"}. Drag the handle or use the arrow buttons to reorder; → nests an item under the one above (up to {MENU_DEPTH} levels). Items linking to unpublished pages stay hidden on the storefront until the page is live.
      </p>
      {items.length === 0 && <div className="card px-6 py-10 text-center text-sm text-muted hover:shadow-elev-1">This menu is empty.</div>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <Level list={items} {...{ items, pages, errors, expanded, readOnly, toggle, apply }} />
      </DndContext>
      {!readOnly && <Button variant="outline" onClick={() => { const c = newItem(newId()); apply(add(items, null, c)); toggle(c.id); }}>Add item</Button>}
    </div>
  );
}
