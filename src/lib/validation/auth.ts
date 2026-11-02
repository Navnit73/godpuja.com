import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email"));

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .refine((v) => new TextEncoder().encode(v).length <= 72, "Use at most 72 bytes")
  .regex(/[a-zA-Z]/, "Include a letter")
  .regex(/[0-9]/, "Include a number");

export const loginSchema = z.object({
  email: email,
  password: z.string().min(1, "Password is required").max(200),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(100),
  email: email,
  password: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
