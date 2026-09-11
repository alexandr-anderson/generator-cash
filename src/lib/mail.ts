import { SUPPORT_EMAIL } from "./legal";

function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function fromAddress() {
  return process.env.MAIL_FROM || "postvmeste <service@postvmeste.ru>";
}

function resendKey() {
  const key = process.env.RESEND_API_KEY?.trim() || process.env.SMTP_PASS?.trim() || "";
  return key.startsWith("re_") ? key : "";
}

export function mailConfigured() {
  return Boolean(resendKey());
}

async function sendMail(to: string, subject: string, text: string) {
  const key = resendKey();
  if (!key) {
    const preview = `[mail:dev] to=${to} subject=${subject}\n${text}`;
    console.info(preview);
    if (process.env.NODE_ENV === "production") {
      throw new Error("Почта не настроена: задайте RESEND_API_KEY");
    }
    return;
  }

  console.info("[mail] sending", { to, subject, from: fromAddress() });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [to],
      subject,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("[mail] Resend error", response.status, body);
    throw new Error("Не удалось отправить письмо. Попробуйте ещё раз.");
  }

  const payload = (await response.json().catch(() => ({}))) as { id?: string };
  console.info("[mail] sent", { to, resendId: payload.id || "unknown" });
}

export async function sendVerificationEmail(email: string, token: string) {
  const url = `${appUrl()}/auth/verify?token=${token}`;
  await sendMail(
    email,
    "Подтвердите почту — postvmeste.ru",
    `Здравствуйте!\n\nВы регистрировались в postvmeste.ru — сервисе, который собирает карусели, посты и обложки Reels.\n\nЧтобы закончить регистрацию, откройте ссылку:\n${url}\n\nОна действует 48 часов и сразу откроет студию — входить отдельно не нужно.\n\nЕсли вы не регистрировались, просто проигнорируйте письмо.\n\nЧто-то пошло не так — напишите на ${SUPPORT_EMAIL}.`,
  );
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${appUrl()}/auth/reset?token=${token}`;
  await sendMail(
    email,
    "Сброс пароля — postvmeste.ru",
    `Здравствуйте!\n\nКто-то запросил новый пароль для вашего аккаунта в postvmeste.ru.\n\nЧтобы задать его, откройте ссылку:\n${url}\n\nСсылка действует час. Старый пароль перестанет работать, и на других устройствах придётся войти заново.\n\nЕсли сброс запрашивали не вы, просто проигнорируйте письмо: пароль останется прежним.\n\nЧто-то пошло не так — напишите на ${SUPPORT_EMAIL}.`,
  );
}
