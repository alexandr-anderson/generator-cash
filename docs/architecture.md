# Архитектура MVP

postvmeste.ru реализован как модульный Next.js-монолит. Текущий интерфейс использует локальный deterministic provider: он позволяет проверить продуктовый путь без передачи пользовательских материалов третьей стороне. Production-провайдеры анализа и генерации должны реализовывать те же контракты, что функции в `src/lib`.

## Границы данных

- `SourceAsset` хранит объектный ключ, MIME, размер, hash, основание использования и срок удаления.
- `ConsentRecord` неизменяемо фиксирует версию политики и отзыв согласия.
- `StyleProfile` отделён от входных файлов и содержит признаки, confidence и evidence.
- `CreativeBrief` описывает задачу, но не структуру редактора.
- `GenerationRun` фиксирует провайдера, модель, seed, стоимость и входной manifest.
- `EditorDocument` — provider-independent JSON со слоями.
- `Export` хранит manifest происхождения результата.

Полная PostgreSQL-модель находится в `prisma/schema.prisma`.

## Production adapters

```ts
interface StyleAnalysisProvider {
  analyze(input: AuthorizedAsset[], signal?: AbortSignal): Promise<StyleProfile>;
}

interface ImageGenerationProvider {
  generate(profile: StyleProfile, brief: CreativeBrief): Promise<CreativeDirection[]>;
}
```

Workers должны выполнять OCR, мультимодальный анализ, генерацию, moderation и экспорт вне HTTP-request lifecycle. Рендер SVG/Canvas остаётся детерминированным и серверным.

## Безопасность и retention

- принимать PNG/JPEG/WEBP после проверки MIME и сигнатуры, с лимитом размера;
- снимать EXIF и геолокацию перед сохранением;
- использовать отдельный prefix object storage на workspace и короткие signed URL;
- не передавать исходники генератору после утверждения структурированного профиля без необходимости;
- не обучать модели на пользовательском контенте по умолчанию;
- удалять исходники автоматически через 30 дней или раньше по запросу;
- каскадно удалять производные assets, документы и exports при удалении проекта;
- считать OCR и metadata недоверенным вводом, не инструкциями модели;
- сохранять synthetic-content flag и C2PA/Content Credentials, когда провайдер поддерживает их.

Произвольный скрейпинг соцсетей намеренно не входит в MVP. Будущие подключения должны использовать OAuth и официальные API аккаунтов, которыми управляет пользователь.
