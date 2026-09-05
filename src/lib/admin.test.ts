import { describe, expect, it } from "vitest";
import {
  adminUserWhere,
  buildAdminUpdates,
  isAdminEmail,
  parseAdminEmails,
  parseAdminUserPatch,
  parseAdminUserQuery,
  toAdminUserRow,
  userIsAdmin,
} from "./admin";

describe("admin emails", () => {
  it("parses a comma-separated list", () => {
    expect([...parseAdminEmails("  a@x.ru, B@x.ru , ")]).toEqual(["a@x.ru", "b@x.ru"]);
  });

  it("matches emails case-insensitively", () => {
    expect(isAdminEmail("A@x.ru", "a@x.ru")).toBe(true);
    expect(isAdminEmail("other@x.ru", "a@x.ru")).toBe(false);
  });

  it("treats role=admin as admin even without env", () => {
    expect(userIsAdmin({ role: "admin", email: "x@x.ru" })).toBe(true);
    expect(userIsAdmin({ role: "user", email: "x@x.ru" })).toBe(false);
  });
});

describe("parseAdminUserQuery", () => {
  it("applies defaults and clamps page size", () => {
    expect(parseAdminUserQuery(new URLSearchParams())).toEqual({
      q: "",
      page: 1,
      pageSize: 20,
      filter: "all",
    });
    expect(parseAdminUserQuery(new URLSearchParams("page=0&pageSize=500&filter=paid")).filter).toBe("paid");
    expect(parseAdminUserQuery(new URLSearchParams("page=0&pageSize=500")).pageSize).toBe(100);
    expect(parseAdminUserQuery(new URLSearchParams("filter=nope")).filter).toBe("all");
  });
});

describe("adminUserWhere", () => {
  it("filters paid, free and banned users", () => {
    expect(adminUserWhere({ q: "anna", filter: "all" })).toEqual({ email: { contains: "anna" } });
    expect(adminUserWhere({ q: "", filter: "banned" })).toEqual({ bannedAt: { not: null } });
    expect(adminUserWhere({ q: "", filter: "paid" })).toEqual({
      bannedAt: null,
      usage: { tier: { not: "free" } },
    });
  });
});

describe("parseAdminUserPatch", () => {
  it("rejects empty and invalid payloads", () => {
    expect(parseAdminUserPatch(null).ok).toBe(false);
    expect(parseAdminUserPatch({}).ok).toBe(false);
    expect(parseAdminUserPatch({ initialFreeRemaining: -1 }).ok).toBe(false);
    expect(parseAdminUserPatch({ tier: "gold" }).ok).toBe(false);
    expect(parseAdminUserPatch({ banned: "yes" }).ok).toBe(false);
  });

  it("accepts a mixed valid patch", () => {
    expect(parseAdminUserPatch({
      initialFreeRemaining: 8,
      tier: "pro",
      banned: false,
    })).toEqual({
      ok: true,
      patch: { initialFreeRemaining: 8, tier: "pro", banned: false },
    });
  });
});

describe("buildAdminUpdates", () => {
  it("blocks self-ban and admin ban", () => {
    expect(buildAdminUpdates({
      patch: { banned: true },
      target: { id: "me", role: "user" },
      actorId: "me",
    })).toEqual({ ok: false, error: "Нельзя заблокировать свой аккаунт" });

    expect(buildAdminUpdates({
      patch: { banned: true },
      target: { id: "other", role: "admin" },
      actorId: "me",
    })).toEqual({ ok: false, error: "Нельзя заблокировать администратора" });
  });

  it("revokes sessions when banning", () => {
    const result = buildAdminUpdates({
      patch: { banned: true },
      target: { id: "u1", role: "user" },
      actorId: "admin",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.revokeSessions).toBe(true);
    expect(result.userData.bannedAt).toBeInstanceOf(Date);
  });

  it("applies paid tier limits and resets the week", () => {
    const result = buildAdminUpdates({
      patch: { tier: "starter", initialFreeRemaining: 3 },
      target: { id: "u1", role: "user" },
      actorId: "admin",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.usageData).toMatchObject({
      tier: "starter",
      generationsPerWeek: 10,
      priceRub: 50,
      generationsUsed: 0,
      initialFreeRemaining: 3,
    });
    expect(result.revokeSessions).toBe(false);
  });
});

describe("toAdminUserRow", () => {
  it("maps a user with usage", () => {
    const weekStartedAt = new Date("2026-09-01T00:00:00.000Z");
    const row = toAdminUserRow({
      id: "u1",
      email: "a@x.ru",
      passwordHash: "x",
      emailVerifiedAt: new Date("2026-09-02T00:00:00.000Z"),
      niche: "Маркетинг",
      audience: null,
      tone: null,
      colors: null,
      logoFileId: null,
      profileCompleted: true,
      profilePopupShown: true,
      role: "user",
      bannedAt: null,
      createdAt: new Date("2026-09-01T12:00:00.000Z"),
      updatedAt: new Date("2026-09-01T12:00:00.000Z"),
      usage: {
        id: "us1",
        userId: "u1",
        tier: "pro",
        generationsPerWeek: 50,
        priceRub: 200,
        generationsUsed: 4,
        weekStartedAt,
        initialFreeRemaining: 0,
        updatedAt: weekStartedAt,
      },
    });
    expect(row.email).toBe("a@x.ru");
    expect(row.subscription.tier).toBe("pro");
    expect(row.subscription.initialFreeRemaining).toBe(0);
    expect(row.bannedAt).toBeNull();
  });
});
