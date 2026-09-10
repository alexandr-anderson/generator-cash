/**
 * Защита от «модель уехала с русского».
 *
 * Продукт продаёт русскоязычный контент, но шлюз может молча подсунуть модель,
 * которая игнорирует инструкцию языка. 2026-09-10 на проде так пришла целая
 * карусель на китайском — с успешным `200 OK` и списанным лимитом.
 *
 * Две степени строгости, сознательно разные (решение от 2026-09-10):
 * - **Катастрофа → ошибка.** Чужая письменность или кириллица потеряла
 *   большинство среди букв. Такой текст показывать нельзя.
 * - **Одиночная латиница → только лог.** «это сигнал crisis» — брак, но не
 *   мусор, а ретрай стоит клиенту лишних двух минут ожидания. Сначала
 *   посмотрим на частоту в логах, потом решим, ужесточать ли.
 */

/** Иероглифы CJK, хангыль, кана, арабица, иврит — всё, чего в русском тексте быть не может. */
const FOREIGN_SCRIPT =
  /[぀-ヿ㐀-䶿一-鿿가-힯؀-ۿ֐-׿]/u;

const CYRILLIC = /\p{Script=Cyrillic}/gu;
const LATIN = /\p{Script=Latin}/gu;
const LATIN_WORD = /(?<![\p{L}\p{N}])[A-Za-z][A-Za-z'’-]*(?![\p{L}\p{N}])/gu;

/** Доля кириллицы среди букв, ниже которой текст считаем сломанным. */
const MIN_CYRILLIC_SHARE = 0.6;

/** Латиница, законная в русском тексте: площадки, форматы, устоявшиеся сокращения. */
const LATIN_ALLOWED = new Set([
  "instagram", "reels", "stories", "vk", "youtube", "shorts", "telegram", "tiktok", "rutube",
  "ai", "cta", "seo", "smm", "it", "hr", "b2b", "b2c", "pdf", "png", "jpg", "zip", "url",
  "postvmeste", "ru", "com", "ok", "pro", "vs", "diy", "ugc",
]);

/** Текст любой вложенности сводим к одной строке для разбора. */
function flatten(input: unknown): string {
  if (typeof input === "string") return input;
  if (Array.isArray(input)) return input.map(flatten).filter(Boolean).join(" ");
  return "";
}

export type RussianVerdict =
  | { ok: true; strayLatin: string[] }
  | { ok: false; reason: string; strayLatin: string[] };

/**
 * Разбирает текст, ничего не бросая. Полезно, когда решение о судьбе ответа
 * принимает вызывающая сторона.
 */
export function inspectRussian(input: unknown): RussianVerdict {
  const text = flatten(input).trim();

  const strayLatin = [
    ...new Set(
      (text.match(LATIN_WORD) || [])
        .map((word) => word.toLowerCase())
        .filter((word) => !LATIN_ALLOWED.has(word)),
    ),
  ];

  // Пустой ответ — не наша забота: на это у каждого вызова своя проверка.
  if (!text) return { ok: true, strayLatin };

  const foreign = text.match(FOREIGN_SCRIPT);
  if (foreign) {
    return { ok: false, reason: `чужая письменность (${foreign[0]})`, strayLatin };
  }

  // Законную латиницу убираем до подсчёта: иначе «Как вести Instagram и Reels»
  // проваливает проверку — на коротком тексте два бренда перевешивают кириллицу.
  const counted = text.replace(LATIN_WORD, (word) =>
    LATIN_ALLOWED.has(word.toLowerCase()) ? " " : word,
  );

  const cyrillic = (counted.match(CYRILLIC) || []).length;
  const latin = (counted.match(LATIN) || []).length;
  const letters = cyrillic + latin;
  if (!letters) return { ok: true, strayLatin };

  const share = cyrillic / letters;
  if (share < MIN_CYRILLIC_SHARE) {
    return {
      ok: false,
      reason: `кириллицы ${Math.round(share * 100)}% из ${letters} букв`,
      strayLatin,
    };
  }

  return { ok: true, strayLatin };
}

/**
 * Пишет в лог одиночные латинские слова — без ошибки. Это материал для решения,
 * ужесточать ли проверку; см. п. 46 в docs/work-plan.md.
 */
export function logStrayLatin(label: string, strayLatin: string[]) {
  if (strayLatin.length) {
    console.warn("[ru-guard] латиница в русском тексте", label, strayLatin.join(", "));
  }
}
