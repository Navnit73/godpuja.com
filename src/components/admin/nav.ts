import type { Permission } from "@/server/auth/permissions";

export type NavItem = { label: string; href: string; permission: Permission };

// Add an item here when its module ships (see docs/IMPLEMENTATION_PLAN.md).
export const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin", permission: "dashboard:read" },
  { label: "Pages", href: "/admin/pages", permission: "pages:read" },
  { label: "Navigation", href: "/admin/navigation", permission: "nav:write" },
  { label: "Users & roles", href: "/admin/users", permission: "users:read" },
];

export const BREADCRUMB_LABELS: Record<string, string> = {
  admin: "Admin",
  users: "Users & roles",
  pages: "Pages",
  navigation: "Navigation",
  new: "New page",
};
