import mongoose from "mongoose";
import { env } from "./env";

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const g = globalThis as typeof globalThis & { _mongoose?: Cache };
const cache: Cache = (g._mongoose ??= { conn: null, promise: null });

/** Single pooled connection reused across requests and HMR reloads. */
export async function connectDB() {
  if (cache.conn) return cache.conn;
  cache.promise ??= mongoose.connect(env().MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 8000,
    bufferCommands: false,
  });
  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null; // allow retry on next request
    throw err;
  }
  return cache.conn;
}
