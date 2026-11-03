import { z } from "zod";
import { ROLES } from "@/lib/roles";
import { passwordSchema } from "./auth";

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email"));
/** Temples a temple operator may manage (PRD v1.1 §12). Only meaningful for scoped roles. */
const templeIds = z.array(z.string().regex(/^[a-f0-9]{24}$/, "Invalid temple")).max(100).transform((ids) => [...new Set(ids)]);

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(100),
  email,
  password: passwordSchema,
  role: z.enum(ROLES),
  templeIds: templeIds.optional(),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2, "Enter a name").max(100),
    role: z.enum(ROLES),
    isActive: z.boolean(),
    password: passwordSchema,
    templeIds,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const listUsersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(ROLES).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
