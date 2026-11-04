import { z } from "zod";
import { isCountry } from "@/lib/address";
import { isCurrency } from "@/lib/money";
import { isTimeZone } from "@/lib/time";
import { passwordSchema } from "./auth";
import { addressSchema } from "./orders";

export const LANGUAGES = ["en", "hi"] as const; // PRD v1.1: English first, Hindi next
const phone = z.string().trim().regex(/^\+?[\d\s-]{8,20}$/, "Enter a valid phone number");

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(100),
  phone: z.union([z.literal(""), phone]).optional(),
  prefs: z.object({
    country: z.string().trim().toUpperCase().refine(isCountry, "Choose a country"),
    language: z.enum(LANGUAGES),
    currency: z.string().trim().toUpperCase().refine(isCurrency, "Choose a currency"),
    timezone: z.string().trim().refine(isTimeZone, "Choose a time zone"),
  }),
}).partial().refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type ProfileInput = z.infer<typeof profileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().max(200).optional(), // not needed when the account has no password yet (Google sign-up)
  newPassword: passwordSchema,
});

export const MAX_ADDRESSES = 10;
export const savedAddressSchema = addressSchema.safeExtend({
  label: z.string().trim().max(40).optional(),
  phone: z.union([z.literal(""), phone]).optional(),
  isDefault: z.boolean().optional(),
});
export type SavedAddressInput = z.infer<typeof savedAddressSchema>;

const token = z.string().trim().regex(/^[A-Za-z0-9_-]{43}$/, "This link is not valid");
export const tokenSchema = z.object({ token });
export const forgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email")) });
export const resetPasswordSchema = z.object({ token, password: passwordSchema });
