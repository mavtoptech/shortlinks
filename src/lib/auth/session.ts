import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "sl_session";
const JWT_SECRET_RAW =
  process.env.JWT_SECRET ||
  "shortlinks-default-secret-change-in-production-please";

const getSecret = () =>
  new TextEncoder().encode(JWT_SECRET_RAW);

export interface SessionPayload {
  userId: string;
  email: string;
  name?: string | null;
}

// Sign a new JWT session token (30 days)
export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

// Verify and decode a JWT session token
export async function verifyToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    });
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      name: (payload.name as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

// Set session cookie (server action context)
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

// Clear session cookie (server action context)
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// Get the current session user from cookies (server action / server component)
export async function getSessionUser(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

// Get session from a NextRequest (middleware context)
export async function getSessionUserFromRequest(
  request: NextRequest
): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}
