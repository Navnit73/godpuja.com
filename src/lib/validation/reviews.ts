import { z } from "zod";

export const REVIEW_STATUSES = ["pending", "published", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const reviewSchema = z.object({
  rating: z.number().int("Choose 1 to 5 stars").min(1, "Choose 1 to 5 stars").max(5, "Choose 1 to 5 stars"),
  title: z.string().trim().max(80, "At most 80 characters").default(""),
  body: z.string().trim().min(10, "Tell others a little more (at least 10 characters)").max(2000, "At most 2000 characters"),
});
export type ReviewInput = z.infer<typeof reviewSchema>;

export const moderateSchema = z.object({
  status: z.enum(["published", "rejected"]),
  note: z.string().trim().max(300).optional(),
});

export const listReviewsSchema = z.object({
  status: z.enum(REVIEW_STATUSES).default("pending"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export const publicReviewsSchema = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
});
