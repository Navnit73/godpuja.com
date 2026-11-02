import { handle } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { exportOrderRows } from "@/server/services/orders";
import { listOrdersSchema } from "@/lib/validation/orders";

// CSV of the filtered orders (newest first, at most 5000 rows), streamed. Cells are formula-injection safe.
export const GET = handle(async (req) => {
  await requireUser("orders:read");
  const q = listOrdersSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const gen = exportOrderRows(q);
  const enc = new TextEncoder();
  let first = true;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await gen.next();
      if (done) { controller.close(); return; }
      controller.enqueue(enc.encode((first ? "\uFEFF" : "") + value)); // BOM so Excel reads UTF-8
      first = false;
    },
    cancel() { gen.return(undefined).catch(() => {}); },
  });
  return new Response(body, { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
    "Cache-Control": "no-store",
  } });
});
