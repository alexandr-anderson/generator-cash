import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { isAdminEmail } from "./admin";
import { prisma } from "./db";

const SESSION_COOKIE = "pv_session";
const SESSION_DAYS = 30;

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken() {
  return randomBytes(32).toString("hex");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

function cookieSecure() {
  return process.env.APP_URL?.startsWith("https://") ?? false;
}

export async function createSession(userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.delete(SESSION_COOKIE);
}

export async function getSessionUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { usage: true } } },
  });
  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    }
    return null;
  }
  if (!session.user.emailVerifiedAt) {
    await prisma.session.deleteMany({ where: { userId: session.userId } }).catch(() => undefined);
    jar.delete(SESSION_COOKIE);
    return null;
  }
  if (session.user.bannedAt) {
    await prisma.session.deleteMany({ where: { userId: session.userId } }).catch(() => undefined);
    jar.delete(SESSION_COOKIE);
    return null;
  }
  if (session.user.role !== "admin" && isAdminEmail(session.user.email)) {
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { role: "admin" },
      include: { usage: true },
    });
    return updated;
  }
  return session.user;
}

export async function requireUser() {
  return getSessionUser();
}
