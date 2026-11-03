import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { ROLE_LABELS, ROLES } from "@/lib/roles";
import { listUsers } from "@/server/services/users";
import { listUsersSchema } from "@/lib/validation/users";
import UsersClient from "./UsersClient";

export const metadata: Metadata = { title: "Users & roles" };

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const user = await currentUser();
  if (!user || !can(user.role, "users:read")) return <Forbidden />;

  const raw = await searchParams;
  // Validate each param on its own so one bad value does not discard the others.
  const pick = <K extends keyof typeof listUsersSchema.shape>(key: K) => {
    const v = raw[key];
    const r = listUsersSchema.shape[key].safeParse(typeof v === "string" && v ? v : undefined);
    return r.success ? r.data : undefined;
  };
  const query = listUsersSchema.parse({ q: pick("q"), role: pick("role"), page: pick("page") });
  const result = await listUsers(query);

  const href = (page: number) => {
    const p = new URLSearchParams();
    if (query.q) p.set("q", query.q);
    if (query.role) p.set("role", query.role);
    if (page > 1) p.set("page", String(page));
    const s = p.toString();
    return `/admin/users${s ? `?${s}` : ""}`;
  };

  if (result.total > 0 && query.page > result.pages) redirect(href(result.pages));

  return (
    <>
      <PageHeader title="Users & roles" description="Manage staff and customer accounts and what each role can do." />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3" role="search">
        <div className="min-w-56 flex-1">
          <label htmlFor="q" className="label">Search</label>
          <input id="q" name="q" defaultValue={query.q} placeholder="Name or email" className="input" />
        </div>
        <div>
          <label htmlFor="role" className="label">Role</label>
          <select id="role" name="role" defaultValue={query.role ?? ""} className="input">
            <option value="">All roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-outline h-10">Filter</button>
        {(query.q || query.role) && <Link href="/admin/users" className="btn-ghost h-10">Clear</Link>}
      </form>

      <UsersClient
        users={result.items}
        canWrite={can(user.role, "users:write")}
        currentUserId={String(user._id)}
        hasFilters={!!(query.q || query.role)}
      />

      {result.pages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          <p className="text-muted">Page {result.page} of {result.pages} · {result.total} users</p>
          <div className="flex gap-2">
            {result.page > 1 && <Link className="btn-outline btn-sm" href={href(result.page - 1)}>Previous</Link>}
            {result.page < result.pages && <Link className="btn-outline btn-sm" href={href(result.page + 1)}>Next</Link>}
          </div>
        </nav>
      )}
    </>
  );
}
