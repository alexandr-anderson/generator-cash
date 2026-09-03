import { createSession, hashToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { json } from "@/lib/http";
import { loadStudio } from "@/lib/studio";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!token) return json({ error: "Нет токена" }, 400);

  const row = await prisma.emailToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    return json({ error: "Ссылка недействительна или устарела" }, 400);
  }

  await prisma.$transaction([
    prisma.emailToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } }),
  ]);

  await createSession(row.userId);
  const studio = await loadStudio(row.userId);
  return json({ ok: true, ...studio });
}
