import { MENU_DEPTH, type MenuItemInput } from "./validation/menus";

type Item = MenuItemInput;

export const newItem = (id: string): Item => ({
  id, label: "", type: "page", ref: undefined, url: "", openInNewTab: false, enabled: true,
  showOnDesktop: true, showOnMobile: true, children: [],
});

/** Number of levels in a subtree (a leaf is 1). */
export const height = (i: Item): number => 1 + Math.max(0, ...i.children.map(height));

export function locate(items: Item[], id: string, parent: Item | null = null, depth = 1): { parent: Item | null; siblings: Item[]; index: number; depth: number } | null {
  for (let index = 0; index < items.length; index++) {
    if (items[index].id === id) return { parent, siblings: items, index, depth };
    const hit = locate(items[index].children, id, items[index], depth + 1);
    if (hit) return hit;
  }
  return null;
}

/** Immutable map over the tree: `fn` returns the replacement list of siblings for the list that contains `id`. */
function editSiblings(items: Item[], id: string, fn: (siblings: Item[], index: number) => Item[]): Item[] {
  const index = items.findIndex((i) => i.id === id);
  if (index >= 0) return fn(items, index);
  return items.map((i) => ({ ...i, children: editSiblings(i.children, id, fn) }));
}

export const update = (items: Item[], id: string, patch: Partial<Item>): Item[] =>
  editSiblings(items, id, (s, i) => s.map((x, n) => (n === i ? { ...x, ...patch } : x)));

export const remove = (items: Item[], id: string): Item[] => editSiblings(items, id, (s, i) => s.filter((_, n) => n !== i));

export function add(items: Item[], parentId: string | null, item: Item): Item[] {
  if (parentId === null) return [...items, item];
  const at = locate(items, parentId);
  if (!at || at.depth >= MENU_DEPTH) return items;
  return update(items, parentId, { children: [...at.siblings[at.index].children, item] });
}

/** Move one step up (-1) or down (+1) among siblings. */
export function move(items: Item[], id: string, dir: -1 | 1): Item[] {
  return editSiblings(items, id, (s, i) => {
    const j = i + dir;
    if (j < 0 || j >= s.length) return s;
    const copy = [...s];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  });
}

/** Reorder among siblings (drag and drop). */
export function reorder(items: Item[], activeId: string, overId: string): Item[] {
  const a = locate(items, activeId);
  const o = locate(items, overId);
  if (!a || !o || a.parent?.id !== o.parent?.id) return items;
  return editSiblings(items, activeId, (s, i) => {
    const copy = [...s];
    const [m] = copy.splice(i, 1);
    copy.splice(o.index, 0, m);
    return copy;
  });
}

export function canIndent(items: Item[], id: string): boolean {
  const at = locate(items, id);
  if (!at || at.index === 0) return false;
  return at.depth + height(at.siblings[at.index]) <= MENU_DEPTH; // would sit one level deeper
}
export const canOutdent = (items: Item[], id: string) => (locate(items, id)?.depth ?? 1) > 1;

/** Make the item the last child of its previous sibling. */
export function indent(items: Item[], id: string): Item[] {
  if (!canIndent(items, id)) return items;
  return editSiblings(items, id, (s, i) => {
    const target = s[i - 1];
    const next = s.filter((_, n) => n !== i).map((x) => (x.id === target.id ? { ...x, children: [...x.children, s[i]] } : x));
    return next;
  });
}

/** Make the item a sibling placed right after its parent. */
export function outdent(items: Item[], id: string): Item[] {
  const at = locate(items, id);
  if (!at?.parent) return items;
  const moving = at.siblings[at.index];
  const parentId = at.parent.id;
  const without = remove(items, id);
  return editSiblings(without, parentId, (s, i) => [...s.slice(0, i + 1), moving, ...s.slice(i + 1)]);
}

export const flatten = (items: Item[]): Item[] => items.flatMap((i) => [i, ...flatten(i.children)]);
