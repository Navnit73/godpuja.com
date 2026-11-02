import { connection } from "next/server";
import { handle, ok } from "@/server/api";
import { getPublicFooter } from "@/server/public/footer";

export const GET = handle(async () => {
  await connection(); // request-time: never read the database during `next build`
  return ok(await getPublicFooter());
});
