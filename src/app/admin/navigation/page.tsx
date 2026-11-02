import type { Metadata } from "next";
import Link from "next/link";
import EmptyState from "@/components/ui/EmptyState";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { formatDateTime } from "@/lib/format";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { listMenus } from "@/server/services/menus";
import CreateMenu from "./CreateMenu";

export const metadata: Metadata = { title: "Navigation" };

export default async function NavigationList() {
  const user = await currentUser();
  if (!user || !can(user.role, "nav:write")) return <Forbidden />;
  const menus = await listMenus();
  const keys = new Set(menus.map((m) => m.key));

  return (
    <>
      <PageHeader title="Navigation" description="Menus shown on the storefront. The “header” menu is the main navigation; an optional “mobile” menu replaces it on small screens." />
      <div className="card mb-6 p-4 hover:shadow-elev-1">
        <CreateMenu suggestions={(["header", "mobile"] as const).filter((k) => !keys.has(k))} />
      </div>
      <div className="card overflow-x-auto p-0 hover:shadow-elev-1">
        {menus.length === 0 ? (
          <EmptyState title="No menus yet" description="Create the “header” menu to show links in the site header." />
        ) : (
          <table className="data-table">
            <caption className="sr-only">Menus</caption>
            <thead><tr><th scope="col">Name</th><th scope="col">Key</th><th scope="col">Items</th><th scope="col">Updated</th></tr></thead>
            <tbody>
              {menus.map((m) => (
                <tr key={m.id}>
                  <td className="font-medium"><Link href={`/admin/navigation/${m.id}`} className="hover:text-primary">{m.name}</Link></td>
                  <td className="text-muted">{m.key}</td>
                  <td>{m.itemCount}</td>
                  <td className="whitespace-nowrap text-muted">{formatDateTime(m.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
