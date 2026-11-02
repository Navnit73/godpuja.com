import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import AdminFrame from "@/components/admin/AdminFrame";
import { ADMIN_NAV } from "@/components/admin/nav";
import { currentUser } from "@/server/auth/guard";
import { can, isStaff } from "@/server/auth/permissions";

export const metadata: Metadata = { title: { default: "Admin — GodPuja", template: "%s — GodPuja Admin" }, robots: { index: false, follow: false } };

// Authoritative, DB-backed check (role + active + tokenVersion). Proxy is only a coarse gate.
async function Gate({ children }: { children: ReactNode }) {
  const user = await currentUser();
  if (!user || !isStaff(user.role)) redirect("/login?next=/admin");
  const items = ADMIN_NAV.filter((i) => can(user.role, i.permission)).map(({ label, href }) => ({ label, href }));
  return <AdminFrame user={{ name: user.name, role: user.role }} items={items}>{children}</AdminFrame>;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="p-8 text-muted" role="status">Loading…</div>}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}
