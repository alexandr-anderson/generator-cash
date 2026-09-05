export const DETACHED_RUBRIC_LABEL = "Без рубрики";

export function worksCountLabel(count: number) {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return `${count} работ`;
  if (last === 1) return `${count} работа`;
  if (last >= 2 && last <= 4) return `${count} работы`;
  return `${count} работ`;
}

export function deleteRubricCopy(name: string, works: number) {
  if (works <= 0) {
    return `«${name}» исчезнет из списка. Шаблон и стиль серии удалятся.`;
  }
  const remain = works === 1 ? "останется" : "останутся";
  return `«${name}» исчезнет из списка. ${worksCountLabel(works)} ${remain} в архиве без рубрики. Шаблон и стиль серии удалятся.`;
}
