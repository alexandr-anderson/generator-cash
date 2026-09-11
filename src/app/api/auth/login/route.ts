import { createSession, verifyPassword } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { json } from "@/lib/http";
import { SUPPORT_EMAIL } from "@/lib/legal";
import { RATE_RULES, clientIp, rateLimit } from "@/lib/rate-limit";
import { loadStudio } from "@/lib/studio";

export async function POST(request: Request) {
  const ipLimited = rateLimit("login-ip", clientIp(request), RATE_RULES.loginIp);
  if (ipLimited) return ipLimited;

  const body = await request.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  const emailLimited = rateLimit("login-email", email, RATE_RULES.loginEmail);
  if (emailLimited) return emailLimited;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return json({ error: "Неверная почта или пароль" }, 401);
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return json({ error: "Неверная почта или пароль" }, 401);
  if (user.bannedAt) {
    return json({ error: `Аккаунт заблокирован. Если это ошибка, напишите на ${SUPPORT_EMAIL} — разберёмся.` }, 403);
  }
  if (!user.emailVerifiedAt) {
    return json({
      // Этот роут ничего не отправляет: письмо было при регистрации и живёт 48 часов.
      // «Мы отправили письмо» заставляло ждать свежего и вело по кругу.
      error: `Почта ещё не подтверждена. Откройте ссылку из письма, которое пришло при регистрации, — она действует 48 часов. Если письма нет или ссылка устарела, напишите на ${SUPPORT_EMAIL}, вышлем новую.`,
      needsVerification: true,
    }, 403);
  }

  await createSession(user.id);
  if (user.role !== "admin" && isAdminEmail(user.email)) {
    await prisma.user.update({ where: { id: user.id }, data: { role: "admin" } });
  }
  const studio = await loadStudio(user.id);
  return json({ ok: true, ...studio });
}
