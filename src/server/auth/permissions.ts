import type { Role } from "@/lib/roles";

export const PERMISSIONS = [
  "dashboard:read",
  "pages:read", "pages:write", "pages:publish",
  "nav:write", "footer:write", "home:write",
  "categories:write", "products:read", "products:write",
  "inventory:write", "media:write",
  "orders:read", "orders:write", "orders:refund",
  "customers:read", "seo:write", "settings:write",
  "users:read", "users:write",
  "coupons:write", "tax:write",
  // PRD v1.1 Phase 2 domains. Defined now so roles are complete; enforced by the modules that ship in Stages 18–22.
  "temples:read", "temples:write", "temples:verify",
  "bookings:read", "bookings:write", "bookings:refund",
  "providers:read", "providers:write",
  "donations:read", "donations:write",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

// Coupons are a store manager's tool; tax rules are finance-sensitive and stay with admin / superadmin only.
const STORE: Permission[] = ["products:read", "products:write", "categories:write", "inventory:write", "media:write", "orders:read", "orders:write", "customers:read", "coupons:write"];
const CONTENT: Permission[] = ["pages:read", "pages:write", "pages:publish", "nav:write", "footer:write", "home:write", "media:write", "seo:write"];

/** PRD v1.1 §12. Temple operators are additionally limited to their assigned temples (see ./scope.ts). */
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  superadmin: PERMISSIONS,
  admin: PERMISSIONS.filter((p) => p !== "users:write"),
  store_manager: ["dashboard:read", ...STORE],
  content_manager: ["dashboard:read", ...CONTENT],
  temple_ops_manager: ["dashboard:read", "temples:read", "temples:write", "temples:verify", "bookings:read", "bookings:write", "donations:read", "media:write"],
  temple_operator: ["dashboard:read", "temples:read", "temples:write", "bookings:read", "bookings:write"],
  provider_manager: ["dashboard:read", "providers:read", "providers:write", "bookings:read", "media:write"],
  booking_manager: ["dashboard:read", "bookings:read", "bookings:write", "bookings:refund", "customers:read"],
  support_agent: ["dashboard:read", "orders:read", "bookings:read", "donations:read", "customers:read"],
  customer: [],
};

export const can = (role: Role, permission: Permission) =>
  ROLE_PERMISSIONS[role]?.includes(permission) ?? false;

export const isStaff = (role: Role) => role !== "customer";
