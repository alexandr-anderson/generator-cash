import { hashPassword, newToken, hashToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { json } from "@/lib/http";
import { LEGAL_VERSION, SUPPORT_EMAIL, parseRegisterConsent } from "@/lib/legal";
import { mailConfigured, sendVerificationEmail } from "@/lib/mail";
import { RATE_RULES, clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limited = rateLimit("register", clientIp(request), RATE_RULES.register);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const niche = String(body?.niche || "").trim();

  if (!email || !email.includes("@")) return json({ error: "Укажите почту" }, 400);
  if (password.length < 6) return json({ error: "Пароль — минимум 6 символов" }, 400);
  if (!niche) return json({ error: "Выберите нишу" }, 400);
  if (!parseRegisterConsent(body)) {
    return json({ error: "Нужно согласие с офертой и политикой" }, 400);
  }
  if (process.env.NODE_ENV === "production" && !mailConfigured()) {
    console.error("[mail] register blocked: RESEND_API_KEY missing");
    return json({
      error: `Не можем отправить письмо с подтверждением, поэтому регистрация сейчас закрыта. Попробуйте позже или напишите на ${SUPPORT_EMAIL} — откроем доступ вручную.`,
    }, 503);
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return json({ error: "Такая почта уже зарегистрирована. Войдите или восстановите пароль." }, 409);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      niche,
      usage: { create: {} },
      consents: { create: { version: LEGAL_VERSION } },
    },
  });

  const token = newToken();
  await prisma.emailToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
  });

  try {
    await sendVerificationEmail(email, token);
  } catch (error) {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    return json({
      error: error instanceof Error ? error.message : "Не удалось отправить письмо",
    }, 502);
  }

  return json({ ok: true, needsVerification: true, email });
}
