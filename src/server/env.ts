import { z } from "zod";
import { isCountry } from "@/lib/address";
import { isTimeZone } from "@/lib/time";

const schema = z.object({
  MONGODB_URI: z.string().startsWith("mongodb"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  SITE_URL: z.url().default("http://localhost:3000"),
  // Media library (Cloudinary). Optional: without them uploads report "not configured" and image URLs can still be pasted.
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  // Checkout. Prices are tax-inclusive paise; shipping = flat fee, free at/above the threshold.
  SHIPPING_FLAT_PAISE: z.coerce.number().int().min(0).default(5000),
  FREE_SHIPPING_OVER_PAISE: z.coerce.number().int().min(0).default(99900),
  // ISO country codes we deliver to, comma-separated (PRD v1.1 §13: never promise shipping where it is not available).
  SHIPPING_COUNTRIES: z.string().default("IN")
    .transform((v) => [...new Set(v.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean))])
    .pipe(z.array(z.string().refine(isCountry, "Unknown ISO country code")).min(1, "List at least one country")),
  // Customer accounts (Stage 13). Public sign-up is open unless set to "false".
  ALLOW_PUBLIC_REGISTRATION: z.enum(["true", "false"]).default("true"),
  // Transactional email via Resend. Without both, emails are logged as "skipped" (and printed in development).
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(), // e.g. "GodPuja <orders@godpuja.com>" (domain verified in Resend)
  // "Continue with Google" (OIDC). Without both, the button is hidden and the routes answer 503.
  // Authorised redirect URI in Google Cloud: <SITE_URL>/api/auth/google/callback
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // IANA zone used for admin date filters and reports (order list "from/to" days).
  ADMIN_TIMEZONE: z.string().default("Asia/Kolkata").refine(isTimeZone, "Unknown IANA time zone"),
  // Shared secret for the generic signed payment webhook (HMAC-SHA256 of the raw body). Without it the webhook is disabled.
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  // Client IP for rate limiting (see server/rate-limit.ts). Either a header your edge overwrites on every request,
  // or the number of trusted proxies that append to X-Forwarded-For (1 = Vercel / a single nginx).
  CLIENT_IP_HEADER: z.string().trim().toLowerCase().regex(/^[a-z0-9-]*$/).optional(), // empty = not set
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(1).max(5).default(1),
});

let cached: z.infer<typeof schema> | undefined;

/** Validated server env. Throws a readable error on first access if misconfigured. */
export function env() {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
      throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`);
    }
    cached = parsed.data;
  }
  return cached;
}
