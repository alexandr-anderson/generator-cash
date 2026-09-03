import { hashToken, newToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { json } from "@/lib/http";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/mail";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const mode = String(body?.mode || "reset");
  if (!email) return json({ ok: true });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return json({ ok: true });

  const token = newToken();
  if (mode === "verify" && !user.emailVerifiedAt) {
    await prisma.emailToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });
    await sendVerificationEmail(email, token);
  } else {
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await sendPasswordResetEmail(email, token);
  }

  return json({ ok: true });
}
