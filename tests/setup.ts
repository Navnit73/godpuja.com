import { config } from "dotenv";
config({ path: ".env.local" });
// Never run tests against the real database.
if (process.env.MONGODB_URI) {
  const u = new URL(process.env.MONGODB_URI);
  u.pathname = "/godpuja_test";
  process.env.MONGODB_URI = u.toString();
}
