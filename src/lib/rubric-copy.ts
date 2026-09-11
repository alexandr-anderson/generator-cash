import { pluralRu } from "./plural";

export const DETACHED_RUBRIC_LABEL = "Без рубрики";

export function worksCountLabel(count: number) {
  return `${count} ${pluralRu(count, "работа", "работы", "работ")}`;
}

/**
 * Последний экран перед необратимым действием, поэтому он называет всё, что уходит.
 *
 * По схеме вместе с рубрикой каскадом удаляются её шаблоны (до трёх, по одному на
 * формат — отсюда множественное число), цвета и снятый с референсов carouselRecipe.
 * Работы не удаляются: Work.rubricId ставится в null. Сами файлы референсов тоже
 * остаются (FileAsset.rubricId — onDelete: SetNull), поэтому «референсы удалятся»
 * было бы неправдой: из рубрики они пропадают, с сервера — нет.
 */
export function deleteRubricCopy(name: string, works: number) {
  const tail = "Цвета, шаблоны и снятый с референсов стиль пропадут вместе с ней. Отменить нельзя.";
  if (works <= 0) {
    return `«${name}» исчезнет из списка. ${tail}`;
  }
  const remain = pluralRu(works, "останется", "останутся", "останутся");
  return `«${name}» исчезнет из списка. ${worksCountLabel(works)} ${remain} в архиве без рубрики. ${tail}`;
}
