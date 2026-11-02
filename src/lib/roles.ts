// Shared (client + server safe): no server imports here.
export const ROLES = ["superadmin", "admin", "editor", "manager", "customer"] as const;
export type Role = (typeof ROLES)[number];
