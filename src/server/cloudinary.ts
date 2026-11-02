import crypto from "node:crypto";
import { ApiError } from "./api";
import { env } from "./env";

type Creds = { cloud: string; key: string; secret: string };
function creds(): Creds {
  const e = env();
  if (!e.CLOUDINARY_CLOUD_NAME || !e.CLOUDINARY_API_KEY || !e.CLOUDINARY_API_SECRET) {
    throw new ApiError("NOT_CONFIGURED", "Image storage is not configured. Set the CLOUDINARY_* environment variables.");
  }
  return { cloud: e.CLOUDINARY_CLOUD_NAME, key: e.CLOUDINARY_API_KEY, secret: e.CLOUDINARY_API_SECRET };
}
export const mediaConfigured = () => { const e = env(); return !!(e.CLOUDINARY_CLOUD_NAME && e.CLOUDINARY_API_KEY && e.CLOUDINARY_API_SECRET); };

/** Cloudinary signature: SHA-1 of the sorted `k=v&…` parameter string followed by the API secret. */
export const sign = (params: Record<string, string | number>, secret: string) =>
  crypto.createHash("sha1").update(Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&") + secret).digest("hex");

async function call<T>(c: Creds, action: "upload" | "destroy", params: Record<string, string | number>, file?: Blob): Promise<T> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signed = { ...params, timestamp };
  const form = new FormData();
  for (const [k, v] of Object.entries(signed)) form.set(k, String(v));
  form.set("api_key", c.key);
  form.set("signature", sign(signed, c.secret));
  if (file) form.set("file", file);
  let res: Response;
  try {
    res = await fetch(`https://api.cloudinary.com/v1_1/${c.cloud}/image/${action}`, { method: "POST", body: form, signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new ApiError("UPSTREAM", "Image storage is unreachable. Try again.");
  }
  const json = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
  if (!res.ok || !json || json.error) throw new ApiError("UPSTREAM", "Image storage rejected the request");
  return json;
}

export type Uploaded = { secure_url: string; public_id: string; width: number; height: number };
export const uploadImage = (file: Blob) => call<Uploaded>(creds(), "upload", { folder: "godpuja" }, file);
export const destroyImage = (publicId: string) => call<{ result: string }>(creds(), "destroy", { public_id: publicId });
