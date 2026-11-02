import type { Metadata } from "next";
import Forbidden from "@/components/ui/Forbidden";
import PageHeader from "@/components/ui/PageHeader";
import { currentUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { userStats } from "@/server/services/users";

export const metadata: Metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const user = await currentUser();
  if (!user || !can(user.role, "dashboard:read")) return <Forbidden />;
  const stats = can(user.role, "users:read") ? await userStats() : null;

  return (
    <>
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} description="Overview of your store. More modules appear here as they are built." />
      {stats && (
        <dl className="grid gap-4 sm:grid-cols-3">
          {[
            ["Total users", stats.total],
            ["Staff", stats.staff],
            ["Customers", stats.customers],
          ].map(([label, value]) => (
            <div key={label} className="card p-5 hover:shadow-elev-1">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="mt-1 text-3xl font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}
