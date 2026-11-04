import { handle, ok, readJson } from "@/server/api";
import { requireUser } from "@/server/auth/guard";
import { addAddress, listAddresses } from "@/server/services/account";
import { savedAddressSchema } from "@/lib/validation/account";

export const GET = handle(async () => ok(await listAddresses(String((await requireUser())._id))));

export const POST = handle(async (req) => {
  const user = await requireUser();
  return ok(await addAddress(String(user._id), savedAddressSchema.parse(await readJson(req))), { status: 201 });
});
