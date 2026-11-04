import type { Metadata } from "next";
import Link from "next/link";
import EmptyState from "@/components/ui/EmptyState";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { listCategories } from "@/server/services/categories";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesList() {
  const user = await currentUser();
  if (!user || !can(user.role, "categories:write")) return <Forbidden />;
  const cats = await listCategories();
  return (
    <>
      <PageHeader title="Categories" description="Organise products into categories and subcategories (up to 3 levels). Each gets its own URL."
        actions={<Link href="/admin/categories/new" className="btn-primary">New category</Link>} />
      <div className="card overflow-x-auto p-0 hover:shadow-elev-1">
        {cats.length === 0 ? (
          <EmptyState title="No categories yet" description="Create your first category, such as Puja kits or Idols."
            action={<Link href="/admin/categories/new" className="btn-primary">New category</Link>} />
        ) : (
          <table className="data-table">
            <caption className="sr-only">Categories</caption>
            <thead><tr><th scope="col">Name</th><th scope="col">URL</th><th scope="col">Products</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium" style={{ paddingLeft: `${0.75 + (c.level - 1) * 1.5}rem` }}>
                    <Link href={`/admin/categories/${c.id}`} className="hover:text-primary">{c.level > 1 && <span aria-hidden="true" className="text-muted">↳ </span>}{c.name}</Link>
                  </td>
                  <td className="text-muted">/shop/{c.path}</td>
                  <td>{c.productCount}</td>
                  <td>{c.isActive ? <span className="badge-success">Active</span> : <span className="badge-muted">Hidden</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
