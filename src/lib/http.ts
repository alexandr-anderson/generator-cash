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
