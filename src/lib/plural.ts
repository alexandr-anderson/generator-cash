/**
 * Склонение слов при числах. Счётчик генераций показывался как «1 из 1 генераций»
 * — а это самое частое состояние бесплатного аккаунта после стартовых пяти.
 */
export function pluralRu(count: number, one: string, few: string, many: string) {
  const abs = Math.abs(count) % 100;
  if (abs > 10 && abs < 20) return many;
  const last = abs % 10;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

/** Для оборота «осталось N из M генераций»: после числительного слово идёт в родительном. */
export function generationsGenitive(count: number) {
  return pluralRu(count, "генерации", "генераций", "генераций");
}
