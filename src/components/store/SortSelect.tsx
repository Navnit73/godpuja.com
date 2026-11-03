"use client";

import { useEffect, useRef } from "react";
import { ChevronDown } from "./Icons";

/** Sort dropdown for the listing toolbar: submits its (GET) form on change. Without JS the toolbar's
 *  <noscript> Apply button does the same job. Once hydrated it also drops empty fields (?min=&max=) from the URL. */
export default function SortSelect({ value, options }: { value: string; options: readonly (readonly [string, string])[] }) {
  const ref = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const prune = (e: FormDataEvent) => { for (const k of [...e.formData.keys()]) if (e.formData.get(k) === "") e.formData.delete(k); };
    form.addEventListener("formdata", prune);
    return () => form.removeEventListener("formdata", prune);
  }, []);
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort" className="text-sm text-muted max-sm:sr-only">Sort by</label>
      <div className="relative">
      <select ref={ref} id="sort" name="sort" defaultValue={value} onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-10 cursor-pointer appearance-none rounded-full border border-input-border bg-surface pl-4 pr-10 text-sm font-medium text-foreground transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      </div>
    </div>
  );
}
