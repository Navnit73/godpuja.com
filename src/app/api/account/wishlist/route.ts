import { z } from "zod";
import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { addToWishlist, wishlistIds } from "@/server/services/wishlist";

export const GET = handle(async () => ok({ ids: await wishlistIds(String((await requireUser())._id)) }));

export const POST = handle(async (req) => {
  const user = await requireUser();
  const { productId } = z.object({ productId: z.string().regex(/^[a-f0-9]{24}$/, "Invalid product") }).parse(await readJson(req));
  return ok(await addToWishlist(String(user._id), productId), { status: 201 });
});
