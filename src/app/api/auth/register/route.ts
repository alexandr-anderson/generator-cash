import { hashPassword, newToken, hashToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { json } from "@/lib/http";
import { sendVerificationEmail } from "@/lib/mail";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const niche = String(body?.niche || "").trim();

  if (!email || !email.includes("@")) return json({ error: "Укажите почту" }, 400);
  if (password.length < 6) return json({ error: "Пароль минимум 6 символов" }, 400);
  if (!niche) return json({ error: "Выберите нишу" }, 400);

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return json({ error: "Такая почта уже зарегистрирована" }, 409);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      niche,
      usage: { create: {} },
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
  await sendVerificationEmail(email, token);

  return json({ ok: true, needsVerification: true, email });
}
