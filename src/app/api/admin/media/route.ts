import { ApiError, handle, ok, readLimited } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { can } from "@/server/auth/permissions";
import { rateLimit } from "@/server/rate-limit";
import { listMedia, MAX_UPLOAD_BYTES, uploadMedia } from "@/server/services/media";
import { z } from "zod";

const listSchema = z.object({ page: z.coerce.number().int().min(1).max(10_000).default(1), limit: z.coerce.number().int().min(1).max(60).default(24) });

// Product editors (managers) pick images from the library without being allowed to manage it.
export const GET = handle(async (req) => {
  const user = await requireUser();
  if (!can(user.role, "media:write") && !can(user.role, "products:write")) throw new ApiError("FORBIDDEN", "Not allowed");
  const { page, limit } = listSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { items, ...meta } = await listMedia(page, limit);
  return ok(items, { meta });
});

export const POST = handle(async (req) => {
  const user = await requireUser("media:write");
  rateLimit(`upload:${String(user._id)}`, 30, 60_000);
  const type = req.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("multipart/form-data")) throw new ApiError("VALIDATION_ERROR", "Send the image as multipart/form-data");
  // Bounded read (works for chunked bodies too) before the multipart parser sees anything.
  const bytes = await readLimited(req, MAX_UPLOAD_BYTES + 100_000).catch(() => { throw new ApiError("VALIDATION_ERROR", "Image is larger than 5 MB", { file: "Max 5 MB" }); });
  const file = (await new Response(bytes as BodyInit, { headers: { "content-type": type } }).formData().catch(() => null))?.get("file");
  if (!(file instanceof File)) throw new ApiError("VALIDATION_ERROR", "Choose an image to upload", { file: "Required" });
  return ok(await uploadMedia(file, String(user._id)), { status: 201 });
});
