import { connection } from "next/server";
import { handle, ok } from "@/server/api";
import { getCategoryTree } from "@/server/public/catalog";

export const GET = handle(async () => {
  await connection();
  return ok(await getCategoryTree());
});
