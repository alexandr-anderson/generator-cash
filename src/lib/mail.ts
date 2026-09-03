import nodemailer from "nodemailer";

function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function fromAddress() {
  return process.env.MAIL_FROM || "postvmeste <noreply@postvmeste.ru>";
}

function transporter() {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
}

async function sendMail(to: string, subject: string, text: string) {
  const transport = transporter();
  if (!transport) {
    console.info(`[mail:dev] to=${to} subject=${subject}\n${text}`);
    return;
  }
  await transport.sendMail({ from: fromAddress(), to, subject, text });
}

export async function sendVerificationEmail(email: string, token: string) {
  const url = `${appUrl()}/auth/verify?token=${token}`;
  await sendMail(
    email,
    "Подтвердите почту — postvmeste.ru",
    `Здравствуйте!\n\nЧтобы закончить регистрацию, откройте ссылку:\n${url}\n\nЕсли вы не регистрировались, просто проигнорируйте письмо.`,
  );
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${appUrl()}/auth/reset?token=${token}`;
  await sendMail(
    email,
    "Сброс пароля — postvmeste.ru",
    `Здравствуйте!\n\nЧтобы задать новый пароль, откройте ссылку:\n${url}\n\nСсылка действует 1 час. Если вы не запрашивали сброс, проигнорируйте письмо.`,
  );
}
