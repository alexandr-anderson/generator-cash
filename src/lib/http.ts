import { userIsAdmin } from "./admin";
import { getSessionUser } from "./auth";
import type { User, UsageState } from "@prisma/client";

export type AuthedUser = User & { usage: UsageState | null };

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export async function authed() {
  const user = await getSessionUser();
  if (!user) return { user: null as AuthedUser | null, error: json({ error: "Нужно войти" }, 401) };
  return { user: user as AuthedUser, error: null };
}

export async function authedAdmin() {
  const result = await authed();
  if (result.error || !result.user) return result;
  if (!userIsAdmin(result.user)) {
    return { user: null as AuthedUser | null, error: json({ error: "Недостаточно прав" }, 403) };
  }
  return result;
}
