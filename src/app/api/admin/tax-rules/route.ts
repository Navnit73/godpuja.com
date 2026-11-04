import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { audit } from "@/server/services/audit";
import { createTaxRule, listTaxRules } from "@/server/services/tax";
import { taxRuleSchema } from "@/lib/validation/coupons";

export const GET = handle(async () => {
  await requireUser("tax:write");
  return ok(await listTaxRules());
});

export const POST = handle(async (req) => {
  const user = await requireUser("tax:write");
  const created = await createTaxRule(taxRuleSchema.parse(await readJson(req)));
  await audit(user, "tax.create", { type: "taxRule", id: created.id }, ["country", "rateBps", "inclusive"]);
  return ok(created, { status: 201 });
});
