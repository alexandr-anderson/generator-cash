/**
 * Достаёт человекочитаемый хвост из недописанного JSON, который печатает модель.
 *
 * Мы просим модель отвечать JSON-ом, поэтому поток выглядит как
 * `{"scenarios":[{"name":"Крючок","slides":["Постоянная устал` — показывать это
 * клиенту нельзя. Здесь остаётся только то, что человек и правда написал бы:
 * содержимое строк, без ключей и без синтаксиса.
 *
 * Разбирать частичный JSON нечем — он невалиден по определению, пока не дописан,
 * поэтому идём по символам и просто следим, внутри строки мы или нет.
 */

/** Сами имена полей — не текст, показывать их незачем. */
const STRUCTURAL_KEYS = new Set(["name", "scenarios", "slides", "hashtags", "caption", "text", "hooks"]);

/**
 * Ключи, чьи **значения** тоже служебные. `name` — это имя сценария
 * («Крючок → Разбор → CTA»), внутренняя кухня: система прямо запрещает пускать
 * такие слова в текст слайдов, значит и в превью им не место.
 */
const STRUCTURAL_VALUES_OF = new Set(["name"]);

export function readableTail(raw: string, limit = 160): string {
  const parts: string[] = [];
  let current = "";
  let inString = false;
  let escaped = false;
  let lastKey = "";

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];

    if (!inString) {
      if (ch === '"') {
        inString = true;
        current = "";
      }
      continue;
    }

    if (escaped) {
      // Внутри потока встречаются \n и \" — первое разворачиваем в пробел,
      // остальное берём как есть.
      current += ch === "n" ? " " : ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = false;
      // Ключ узнаём по двоеточию сразу за закрывающей кавычкой.
      const isKey = raw[i + 1] === ":";
      if (isKey) {
        lastKey = current;
      } else if (!STRUCTURAL_KEYS.has(current) && !STRUCTURAL_VALUES_OF.has(lastKey)) {
        parts.push(current);
      }
      current = "";
      continue;
    }
    current += ch;
  }

  // Незакрытая строка — это ровно то, что модель печатает прямо сейчас.
  if (inString && current && !STRUCTURAL_VALUES_OF.has(lastKey)) parts.push(current);

  const text = parts.join(" · ").replace(/\s+/g, " ").trim();
  return text.length > limit ? `…${text.slice(-limit)}` : text;
}
