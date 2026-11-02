import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { ZodError } from "zod";

export type ErrorCode =
  | "VALIDATION_ERROR" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND"
  | "CONFLICT" | "RATE_LIMITED" | "NOT_CONFIGURED" | "UPSTREAM" | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400, UNAUTHENTICATED: 401, FORBIDDEN: 403,
  NOT_FOUND: 404, CONFLICT: 409, RATE_LIMITED: 429, NOT_CONFIGURED: 503, UPSTREAM: 502, INTERNAL: 500,
};

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public fields?: Record<string, string>,
    public headers?: Record<string, string>,
  ) {
    super(message);
  }
}

export const ok = <T>(data: T, init?: { status?: number; meta?: unknown }) =>
  NextResponse.json({ data, ...(init?.meta ? { meta: init.meta } : {}) }, { status: init?.status ?? 200 });

/** Wrap a route handler: same-origin check on mutations, uniform error envelope. */
export function handle<C = unknown>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx?: C) => {
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) assertSameOrigin(req);
      return await fn(req, ctx as C);
    } catch (err) {
      unstable_rethrow(err); // Next.js control-flow signals (prerender bail-out, redirects) must propagate, not become 500s
      if (err instanceof ZodError) {
        const fields: Record<string, string> = {};
        for (const i of err.issues) fields[i.path.join(".") || "_"] ??= i.message;
        err = new ApiError("VALIDATION_ERROR", "Invalid input", fields);
      }
      // Data the schema layer rejects (bad keys, casts) is the caller's fault, not a server error.
      if (err instanceof mongoose.Error.ValidationError || err instanceof mongoose.Error.CastError) {
        err = new ApiError("VALIDATION_ERROR", "Invalid input");
      }
      if (err instanceof ApiError) {
        return NextResponse.json(
          { error: { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) } },
          { status: STATUS[err.code], headers: err.headers },
        );
      }
      console.error("[api] unhandled error", err);
      return NextResponse.json(
        { error: { code: "INTERNAL", message: "Something went wrong" } },
        { status: 500 },
      );
    }
  };
}

function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin) return; // non-browser clients; cookies are SameSite=Lax anyway
  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    // e.g. "Origin: null" -> treated as cross-origin
  }
  const allowed = req.headers.get("x-forwarded-host") ?? host;
  if (!originHost || !allowed || originHost !== allowed) {
    throw new ApiError("FORBIDDEN", "Cross-origin request blocked");
  }
}

const MAX_BODY_BYTES = 1_000_000; // 1 MB; page content is capped well below this

/**
 * Read a request body but stop (and reject) as soon as it exceeds `max` bytes. Unlike trusting Content-Length,
 * this also bounds chunked requests that carry no length header.
 */
export async function readLimited(req: Request, max: number): Promise<Uint8Array> {
  const tooBig = () => new ApiError("VALIDATION_ERROR", "Request body is too large");
  if (Number(req.headers.get("content-length") ?? 0) > max) throw tooBig();
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel().catch(() => {}); throw tooBig(); }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.byteLength; }
  return out;
}

export async function readJson(req: Request) {
  if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    throw new ApiError("VALIDATION_ERROR", "Content-Type must be application/json");
  }
  const bytes = await readLimited(req, MAX_BODY_BYTES);
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiError("VALIDATION_ERROR", "Request body must be valid JSON");
  }
}
