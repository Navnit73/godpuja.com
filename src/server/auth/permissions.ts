import type { Role } from "../models/User";

export const PERMISSIONS = [
  "dashboard:read",
  "pages:read", "pages:write", "pages:publish",
  "nav:write", "footer:write", "home:write",
  "categories:write", "products:read", "products:write",
  "inventory:write", "media:write",
  "orders:read", "orders:write", "orders:refund",
  "customers:read", "seo:write", "settings:write",
  "users:read", "users:write",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  superadmin: PERMISSIONS,
  admin: PERMISSIONS.filter((p) => p !== "users:write"),
  editor: [
    "dashboard:read", "pages:read", "pages:write", "pages:publish",
    "nav:write", "footer:write", "home:write", "media:write", "seo:write",
  ],
  manager: [
    "dashboard:read", "products:read", "products:write", "inventory:write",
    "orders:read", "orders:write", "customers:read",
  ],
  customer: [],
};

export const can = (role: Role, permission: Permission) =>
  ROLE_PERMISSIONS[role]?.includes(permission) ?? false;

export const isStaff = (role: Role) => role !== "customer";
