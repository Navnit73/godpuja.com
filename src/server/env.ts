import { z } from "zod";

const schema = z.object({
  MONGODB_URI: z.string().startsWith("mongodb"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  SITE_URL: z.url().default("http://localhost:3000"),
  // Media library (Cloudinary). Optional: without them uploads report "not configured" and image URLs can still be pasted.
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
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
