"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { api, ApiClientError } from "@/lib/api";
import { slugify } from "@/lib/slug";
import type { AdminMenu } from "@/server/services/menus";

export default function CreateMenu({ suggestions }: { suggestions: readonly string[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ form?: string; name?: string; key?: string }>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr({});
    try {
      const m = await api.post<AdminMenu>("/admin/menus", { key, name });
      router.push(`/admin/navigation/${m.id}`);
    } catch (e2) {
      if (e2 instanceof ApiClientError) setErr({ form: e2.fields ? undefined : e2.message, name: e2.fields?.name, key: e2.fields?.key });
      else setErr({ form: "Could not create the menu" });
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-start gap-3" noValidate>
      <div className="min-w-48 flex-1">
        <Input label="Menu name" value={name} error={err.name} placeholder="Header"
          onChange={(e) => { setName(e.target.value); if (!touched) setKey(slugify(e.target.value)); }} />
      </div>
      <div className="min-w-48 flex-1">
        <Input label="Key" value={key} error={err.key} hint={suggestions.length ? `Use ${suggestions.map((s) => `“${s}”`).join(" or ")} for the storefront` : "Used to look the menu up"}
          onChange={(e) => { setKey(e.target.value); setTouched(true); }} />
      </div>
      <Button type="submit" className="mt-6" loading={busy}>Create menu</Button>
      {err.form && <p role="alert" className="field-error w-full">{err.form}</p>}
    </form>
  );
}
