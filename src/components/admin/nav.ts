import type { Permission } from "@/server/auth/permissions";

export type NavItem = { label: string; href: string; permission: Permission };

// Add an item here when its module ships (see docs/IMPLEMENTATION_PLAN.md).
export const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin", permission: "dashboard:read" },
  { label: "Pages", href: "/admin/pages", permission: "pages:read" },
  { label: "Homepage", href: "/admin/homepage", permission: "home:write" },
  { label: "Categories", href: "/admin/categories", permission: "categories:write" },
  { label: "Products", href: "/admin/products", permission: "products:read" },
  { label: "Orders", href: "/admin/orders", permission: "orders:read" },
  { label: "Inventory", href: "/admin/inventory", permission: "inventory:write" },
  { label: "Media", href: "/admin/media", permission: "media:write" },
  { label: "SEO", href: "/admin/seo", permission: "seo:write" },
  { label: "Navigation", href: "/admin/navigation", permission: "nav:write" },
  { label: "Footer", href: "/admin/footer", permission: "footer:write" },
  { label: "Users & roles", href: "/admin/users", permission: "users:read" },
];

export const BREADCRUMB_LABELS: Record<string, string> = {
  admin: "Admin",
  users: "Users & roles",
  pages: "Pages",
  navigation: "Navigation",
  seo: "SEO",
  homepage: "Homepage",
  categories: "Categories",
  products: "Products",
  inventory: "Inventory",
  orders: "Orders",
  media: "Media",
  footer: "Footer",
  new: "New page",
};
