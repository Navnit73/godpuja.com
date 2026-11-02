import bcrypt from "bcryptjs";

const COST = 12;
// Valid hash used to equalise timing when the user does not exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", COST);

export const hashPassword = (plain: string) => bcrypt.hash(plain, COST);

export async function verifyPassword(plain: string, hash: string | undefined) {
  const ok = await bcrypt.compare(plain, hash ?? DUMMY_HASH);
  return hash ? ok : false;
}
