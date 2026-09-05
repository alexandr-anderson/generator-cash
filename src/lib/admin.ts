import type { Prisma, UsageState, User, UserRole } from "@prisma/client";
import { TIER_LIMITS, remainingFromUsage, weeklyRemainingFromUsage } from "./quota";
import type { AdminUserFilter, AdminUserPatch, AdminUserRow, Subscription } from "./types";

const ADMIN_FILTERS = new Set<AdminUserFilter>(["all", "paid", "free", "banned"]);

export function parseAdminEmails(raw = process.env.ADMIN_EMAILS) {
  return new Set(
    (raw || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string, rawEmails = process.env.ADMIN_EMAILS) {
  return parseAdminEmails(rawEmails).has(email.trim().toLowerCase());
}

export function userIsAdmin(user: { role: UserRole; email: string }) {
  return user.role === "admin" || isAdminEmail(user.email);
}

export function parseAdminUserQuery(searchParams: URLSearchParams) {
  const q = (searchParams.get("q") || "").trim();
  const page = Math.max(1, Math.floor(Number(searchParams.get("page")) || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(searchParams.get("pageSize")) || 20)));
  const rawFilter = (searchParams.get("filter") || "all") as AdminUserFilter;
  const filter = ADMIN_FILTERS.has(rawFilter) ? rawFilter : "all";
  return { q, page, pageSize, filter };
}

export function adminUserWhere(query: { q: string; filter: AdminUserFilter }): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};
  if (query.q) {
    where.email = { contains: query.q };
  }
  if (query.filter === "banned") {
    where.bannedAt = { not: null };
  } else if (query.filter === "paid") {
    where.bannedAt = null;
    where.usage = { tier: { not: "free" } };
  } else if (query.filter === "free") {
    where.bannedAt = null;
    where.OR = [{ usage: { is: null } }, { usage: { tier: "free" } }];
  }
  return where;
}

export function parseAdminUserPatch(body: unknown): { ok: true; patch: AdminUserPatch } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Некорректный запрос" };
  const src = body as Record<string, unknown>;
  const patch: AdminUserPatch = {};

  if ("initialFreeRemaining" in src) {
    const n = Number(src.initialFreeRemaining);
    if (!Number.isInteger(n) || n < 0 || n > 999) {
      return { ok: false, error: "Бесплатные генерации: целое число от 0 до 999" };
    }
    patch.initialFreeRemaining = n;
  }

  if ("tier" in src) {
    const tier = String(src.tier) as Subscription["tier"];
    if (!(tier in TIER_LIMITS)) return { ok: false, error: "Неизвестный тариф" };
    patch.tier = tier;
  }

  if ("banned" in src) {
    if (typeof src.banned !== "boolean") return { ok: false, error: "Некорректный статус блокировки" };
    patch.banned = src.banned;
  }

  if (
    patch.initialFreeRemaining === undefined &&
    patch.tier === undefined &&
    patch.banned === undefined
  ) {
    return { ok: false, error: "Нечего менять" };
  }

  return { ok: true, patch };
}

export function buildAdminUpdates(input: {
  patch: AdminUserPatch;
  target: { id: string; role: UserRole };
  actorId: string;
}):
  | { ok: false; error: string }
  | {
      ok: true;
      userData: Prisma.UserUpdateInput;
      usageData: Prisma.UsageStateUpdateInput;
      revokeSessions: boolean;
    } {
  const { patch, target, actorId } = input;
  if (patch.banned === true) {
    if (target.id === actorId) return { ok: false, error: "Нельзя заблокировать свой аккаунт" };
    if (target.role === "admin") return { ok: false, error: "Нельзя заблокировать администратора" };
  }

  const userData: Prisma.UserUpdateInput = {};
  const usageData: Prisma.UsageStateUpdateInput = {};
  let revokeSessions = false;

  if (patch.banned === true) {
    userData.bannedAt = new Date();
    revokeSessions = true;
  } else if (patch.banned === false) {
    userData.bannedAt = null;
  }

  if (patch.tier) {
    const limits = TIER_LIMITS[patch.tier];
    usageData.tier = patch.tier;
    usageData.generationsPerWeek = limits.generationsPerWeek;
    usageData.priceRub = limits.priceRub;
    usageData.generationsUsed = 0;
    usageData.weekStartedAt = new Date();
  }

  if (patch.initialFreeRemaining !== undefined) {
    usageData.initialFreeRemaining = patch.initialFreeRemaining;
  }

  return { ok: true, userData, usageData, revokeSessions };
}

export function toAdminUserRow(user: User & { usage: UsageState | null }): AdminUserRow {
  const usage = user.usage;
  return {
    id: user.id,
    email: user.email,
    niche: user.niche,
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.getTime() : null,
    createdAt: user.createdAt.getTime(),
    bannedAt: user.bannedAt ? user.bannedAt.getTime() : null,
    subscription: {
      tier: usage?.tier ?? "free",
      generationsPerWeek: usage?.generationsPerWeek ?? 1,
      priceRub: usage?.priceRub ?? 0,
      generationsUsed: usage?.generationsUsed ?? 0,
      weekStartedAt: usage?.weekStartedAt.getTime() ?? Date.now(),
      initialFreeRemaining: usage?.initialFreeRemaining ?? 0,
    },
    remaining: remainingFromUsage(usage),
    weeklyRemaining: weeklyRemainingFromUsage(usage),
  };
}
