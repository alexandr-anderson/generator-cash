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
