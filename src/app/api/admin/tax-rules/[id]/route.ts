import { z } from "zod";
import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { audit } from "@/server/services/audit";
import { deleteTaxRule, updateTaxRule } from "@/server/services/tax";
import { taxRuleSchema } from "@/lib/validation/coupons";

type Ctx = RouteContext<"/api/admin/tax-rules/[id]">;
const updateSchema = taxRuleSchema.safeExtend({ baseUpdatedAt: z.iso.datetime({ offset: true }) });

export const PATCH = handle(async (req, ctx: Ctx) => {
  const user = await requireUser("tax:write");
  const id = (await ctx.params).id;
  const updated = await updateTaxRule(id, updateSchema.parse(await readJson(req)));
  await audit(user, "tax.update", { type: "taxRule", id }, ["rate"]);
  return ok(updated);
});

export const DELETE = handle(async (_req, ctx: Ctx) => {
  const user = await requireUser("tax:write");
  const id = (await ctx.params).id;
  await deleteTaxRule(id);
  await audit(user, "tax.delete", { type: "taxRule", id });
  return ok({ deleted: true });
});
