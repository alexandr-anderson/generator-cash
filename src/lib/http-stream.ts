import { AiError } from "./openai";

/**
 * Ответ роута строкой-за-строкой (NDJSON) вместо одного JSON в конце.
 *
 * Зачем: шлюз молчит около двух минут до первого байта, и на этой паузе
 * соединение рвётся — поймано на проде 2026-09-10 (`net::ERR_CONNECTION_TIMED_OUT`).
 * Пока мы ждём модель, поток отдаёт дельты текста, связь не простаивает, а человек
 * видит, как ответ набирается, вместо трёхминутного спиннера.
 *
 * Формат строк:
 * - `{"type":"delta","text":"…"}` — кусок текста от модели, по мере поступления;
 * - `{"type":"result", …}` — готовый результат, той же формы, что раньше отдавал JSON;
 * - `{"type":"error","error":"…"}` — сорвалось.
 *
 * Важно: заголовки уходят до того, как мы узнаем исход, поэтому статус всегда `200`,
 * а об ошибке сообщает строка `error`. Всё, что проверяется **до** обращения к модели
 * (квота, лимиты, занятый слот, валидация тела), по-прежнему отвечает обычным JSON с
 * честным кодом — так что привычные пути ошибок не поменялись.
 */
export function ndjsonStream<T extends object>(
  run: (emit: (line: object) => void) => Promise<T>,
  onSettled?: () => void,
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (line: object) => {
        if (closed) return; // после close() enqueue бросает
        controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
      };

      // Дельты идут только пока печатает текстовая модель. Картинки рисуются
      // молча — это несколько минут тишины, и её убивал сторож в PHP-прокси
      // (CURLOPT_LOW_SPEED_TIME): поймано живым прогоном 2026-09-10, пост падал
      // ровно на 159-й секунде. Поэтому сердцебиение: пока идёт работа, в поток
      // капают строки, которые клиент молча пропускает.
      // Раз в 10 секунд, не реже: сторож считает среднюю скорость за 120 секунд
      // и рвёт связь ниже байта в секунду, так что запас должен быть заметным.
      const heartbeat = setInterval(() => emit({ type: "ping" }), 10_000);

      try {
        // Первая строка уходит сразу — она и держит соединение живым, пока
        // модель думает. Без неё прокси видит ту же тишину, что и раньше.
        emit({ type: "start" });
        const result = await run(emit);
        emit({ type: "result", ...result });
      } catch (caught) {
        const message = caught instanceof AiError
          ? caught.message
          : "Не удалось сгенерировать текст. Попробуйте ещё раз.";
        if (!(caught instanceof AiError)) console.error("[ndjson]", caught);
        emit({ type: "error", error: message });
      } finally {
        clearInterval(heartbeat);
        onSettled?.();
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      // Просьба к nginx-подобным прокси не копить ответ в буфере: смысл потока
      // именно в том, чтобы байты уходили сразу.
      "x-accel-buffering": "no",
    },
  });
}
