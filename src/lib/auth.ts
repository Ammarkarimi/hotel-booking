import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import {
  COOKIE_NAME,
  createSessionToken,
  verifySessionToken,
  type SessionUser,
} from "./session";

export type { SessionUser };
export { COOKIE_NAME, SESSION_DURATION } from "./session";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(user: SessionUser): Promise<string> {
  return createSessionToken(user);
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  return verifySessionToken(token);
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function login(email: string, password: string): Promise<SessionUser | null> {
  const staff = await prisma.staff.findUnique({ where: { email } });
  if (!staff) return null;

  const valid = await verifyPassword(password, staff.passwordHash);
  if (!valid) return null;

  return {
    id: staff.id,
    email: staff.email,
    name: staff.name,
    role: staff.role,
  };
}
