import type { Permission } from "@/server/auth/permissions";
import type { IconName } from "./icons";

export type NavGroup = "Overview" | "Content" | "Commerce" | "Settings";
export type NavItem = { label: string; href: string; permission: Permission; icon: IconName; group: NavGroup };
export const NAV_GROUPS: NavGroup[] = ["Overview", "Content", "Commerce", "Settings"];

// Add an item here when its module ships (see docs/IMPLEMENTATION_PLAN.md).
export const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin", permission: "dashboard:read", icon: "dashboard", group: "Overview" },
  { label: "Pages", href: "/admin/pages", permission: "pages:read", icon: "pages", group: "Content" },
  { label: "Homepage", href: "/admin/homepage", permission: "home:write", icon: "home", group: "Content" },
  { label: "Categories", href: "/admin/categories", permission: "categories:write", icon: "categories", group: "Commerce" },
  { label: "Products", href: "/admin/products", permission: "products:read", icon: "products", group: "Commerce" },
  { label: "Orders", href: "/admin/orders", permission: "orders:read", icon: "orders", group: "Commerce" },
  { label: "Inventory", href: "/admin/inventory", permission: "inventory:write", icon: "inventory", group: "Commerce" },
  { label: "Media", href: "/admin/media", permission: "media:write", icon: "media", group: "Content" },
  { label: "SEO", href: "/admin/seo", permission: "seo:write", icon: "seo", group: "Settings" },
  { label: "Navigation", href: "/admin/navigation", permission: "nav:write", icon: "navigation", group: "Content" },
  { label: "Footer", href: "/admin/footer", permission: "footer:write", icon: "footer", group: "Content" },
  { label: "Users & roles", href: "/admin/users", permission: "users:read", icon: "users", group: "Settings" },
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
