import mongoose from "mongoose";
import { ApiError } from "../api";
import { destroyImage, uploadImage } from "../cloudinary";
import { connectDB } from "../db";
import { Category } from "../models/Category";
import { Media, type MediaDoc } from "../models/Media";
import { Product } from "../models/Product";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export type MediaItem = { id: string; url: string; filename: string; mime: string; size: number; width: number | null; height: number | null; alt: string; createdAt: string };

const toItem = (m: MediaDoc): MediaItem => ({
  id: String(m._id), url: m.url, filename: m.filename, mime: m.mime, size: m.size, width: m.width ?? null, height: m.height ?? null, alt: m.alt ?? "", createdAt: m.createdAt.toISOString(),
});

/** Detect the real image type from magic bytes; the client-declared type and extension are never trusted. */
export function sniffImage(b: Uint8Array): "image/jpeg" | "image/png" | "image/gif" | "image/webp" | null {
  const at = (i: number, ...v: number[]) => v.every((x, n) => b[i + n] === x);
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0x47, 0x49, 0x46, 0x38) && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) return "image/gif";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  return null;
}

const cleanName = (n: string) => n.replace(/[^\w.\- ]+/g, "_").replace(/\.{2,}/g, ".").slice(0, 120) || "image";

export async function uploadMedia(file: File, userId: string) {
  if (file.size === 0) throw new ApiError("VALIDATION_ERROR", "The file is empty", { file: "Empty file" });
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError("VALIDATION_ERROR", "Image is larger than 5 MB", { file: "Max 5 MB" });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffImage(bytes);
  if (!mime) throw new ApiError("VALIDATION_ERROR", "Only JPEG, PNG, GIF or WebP images are allowed", { file: "Unsupported image type" });
  const up = await uploadImage(new Blob([bytes], { type: mime }));
  await connectDB();
  try {
    const m = await Media.create({ url: up.secure_url, publicId: up.public_id, filename: cleanName(file.name), mime, size: file.size, width: up.width, height: up.height, uploadedBy: userId });
    return toItem(m.toObject() as MediaDoc);
  } catch (err) {
    await destroyImage(up.public_id).catch(() => {}); // do not leave an orphan in storage
    throw err;
  }
}

export async function listMedia(page: number, limit: number) {
  await connectDB();
  const [rows, total] = await Promise.all([
    Media.find().sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Media.estimatedDocumentCount(),
  ]);
  return { items: rows.map(toItem), total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function updateMediaAlt(id: string, alt: string) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError("NOT_FOUND", "Image not found");
  await connectDB();
  const m = await Media.findByIdAndUpdate(id, { $set: { alt } }, { returnDocument: "after" }).lean();
  if (!m) throw new ApiError("NOT_FOUND", "Image not found");
  return toItem(m);
}

/** Refuses while a product or category still uses the image, so storefront images never break. */
export async function deleteMedia(id: string) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError("NOT_FOUND", "Image not found");
  await connectDB();
  const m = await Media.findById(id).lean();
  if (!m) throw new ApiError("NOT_FOUND", "Image not found");
  const [inProduct, inCategory] = await Promise.all([Product.exists({ "images.url": m.url }), Category.exists({ "image.url": m.url })]);
  if (inProduct || inCategory) throw new ApiError("CONFLICT", "This image is used by a product or category. Remove it there first.");
  await destroyImage(m.publicId);
  await Media.deleteOne({ _id: id });
}
