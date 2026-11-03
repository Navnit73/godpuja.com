// Shared (client + server safe): no server imports here. Roles from PRD v1.1 §12.
export const ROLES = [
  "superadmin", "admin",
  "store_manager", "content_manager",
  "temple_ops_manager", "temple_operator",
  "provider_manager", "booking_manager", "support_agent",
  "customer",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Super admin",
  admin: "Admin",
  store_manager: "Store manager",
  content_manager: "Content manager",
  temple_ops_manager: "Temple operations manager",
  temple_operator: "Temple operator",
  provider_manager: "Pandit / provider manager",
  booking_manager: "Booking manager",
  support_agent: "Support agent",
  customer: "Customer",
};

/** Role names used before Stage 12. Stored values are migrated by scripts/migrate-stage12.ts; this map keeps old rows and sessions working until then. */
export const LEGACY_ROLES: Readonly<Record<string, Role>> = { editor: "content_manager", manager: "store_manager" };

export function normalizeRole(value: unknown): Role | null {
  if (typeof value !== "string") return null;
  if ((ROLES as readonly string[]).includes(value)) return value as Role;
  return LEGACY_ROLES[value] ?? null;
}

/** Roles limited to the temples assigned to the user (`User.templeIds`). PRD v1.1 §12 / §15.1. */
export const TEMPLE_SCOPED_ROLES: readonly Role[] = ["temple_operator"];
export const isTempleScoped = (role: Role) => TEMPLE_SCOPED_ROLES.includes(role);
