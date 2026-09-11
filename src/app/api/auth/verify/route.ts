import { createSession, hashToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { json } from "@/lib/http";
import { SUPPORT_EMAIL } from "@/lib/legal";
import { loadStudio } from "@/lib/studio";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!token) return json({ error: "В ссылке нет кода подтверждения — похоже, она скопировалась не целиком." }, 400);

  const row = await prisma.emailToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    return json({ error: `Ссылка уже использована или устарела — она действует 48 часов. Напишите на ${SUPPORT_EMAIL}, пришлём новую.` }, 400);
  }

  await prisma.$transaction([
    prisma.emailToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } }),
  ]);

  await createSession(row.userId);
  const studio = await loadStudio(row.userId);
  return json({ ok: true, ...studio });
}
