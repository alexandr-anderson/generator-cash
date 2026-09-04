import { createSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { json } from "@/lib/http";
import { loadStudio } from "@/lib/studio";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return json({ error: "Неверная почта или пароль" }, 401);
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return json({ error: "Неверная почта или пароль" }, 401);
  if (!user.emailVerifiedAt) {
    return json({ error: "Сначала подтвердите почту — мы отправили письмо", needsVerification: true }, 403);
  }

  await createSession(user.id);
  const studio = await loadStudio(user.id);
  return json({ ok: true, ...studio });
}
