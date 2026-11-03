import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { normalizeRole, type Role } from "@/lib/roles";

export const SESSION_COOKIE = "gp_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type Session = { uid: string; role: Role; tv: number };

const key = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET missing or too short");
  return new TextEncoder().encode(secret);
};

export const signSession = (s: Session) =>
  new SignJWT({ role: s.role, tv: s.tv })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.uid)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    const role = normalizeRole(payload.role); // pre-Stage-12 sessions carry "editor"/"manager"
    const tv = payload.tv;
    if (!payload.sub || !role || typeof tv !== "number") return null;
    return { uid: payload.sub, role, tv };
  } catch {
    return null;
  }
}

export async function setSessionCookie(session: Session) {
  (await cookies()).set(SESSION_COOKIE, await signSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSession() {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}
