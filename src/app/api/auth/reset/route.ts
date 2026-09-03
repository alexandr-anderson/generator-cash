import { createSession, hashPassword, hashToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { json } from "@/lib/http";
import { loadStudio } from "@/lib/studio";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = String(body?.token || "");
  const password = String(body?.password || "");
  if (password.length < 6) return json({ error: "Пароль минимум 6 символов" }, 400);

  const row = await prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    return json({ error: "Ссылка недействительна или устарела" }, 400);
  }

  await prisma.$transaction([
    prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash: await hashPassword(password) },
    }),
    prisma.session.deleteMany({ where: { userId: row.userId } }),
  ]);

  await createSession(row.userId);
  const studio = await loadStudio(row.userId);
  return json({ ok: true, ...studio });
}
