import { connection } from "next/server";
import { handle, ok } from "@/server/api";
import { getPublicHomepage } from "@/server/public/homepage";

export const GET = handle(async () => {
  await connection(); // request-time: never read the database during `next build`
  return ok(await getPublicHomepage());
});
