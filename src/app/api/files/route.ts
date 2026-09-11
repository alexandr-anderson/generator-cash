import { prisma } from "@/lib/db";
import { authed, json } from "@/lib/http";
import { RATE_RULES, rateLimit } from "@/lib/rate-limit";
import { MAX_UPLOAD_BYTES, filePublicPath, saveUserBuffer } from "@/lib/storage";
import type { FileKind } from "@prisma/client";

const KINDS = new Set<FileKind>(["logo", "reference", "photo", "export"]);

// Uploads are sent as a raw binary body (Content-Type: <mime>) with metadata
// in headers, not multipart/form-data — the hosting strips the body of any
// multipart/form-data request before it reaches Node (Content-Length itself
// disappears), regardless of what's actually inside it. Verified by testing
// octet-stream and image/* bodies (arrive intact) against multipart bodies
// (arrive as 0 bytes) on the same route.
export async function POST(request: Request) {
  const { user, error } = await authed();
  if (error) return error;

  const limited = rateLimit("upload", user.id, RATE_RULES.upload);
  if (limited) return limited;

  const kind = (request.headers.get("x-file-kind") || "reference") as FileKind;
  const rubricIdHeader = request.headers.get("x-rubric-id");
  const rubricId = rubricIdHeader?.trim() || null;
  const mimeType = request.headers.get("content-type") || "";
  if (!KINDS.has(kind)) return json({ error: "Можно загрузить только PNG, JPEG или WEBP" }, 400);

  // Checked before reading the body: arrayBuffer() would otherwise pull the
  // whole payload into memory before saveUserBuffer gets to reject its size.
  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > MAX_UPLOAD_BYTES) return json({ error: "Файл больше 8 МБ. Сожмите картинку и попробуйте снова." }, 413);

  if (rubricId) {
    const owned = await prisma.rubric.findFirst({
      where: { id: rubricId, userId: user.id },
      select: { id: true },
    });
    if (!owned) return json({ error: "Рубрика не найдена" }, 404);
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await request.arrayBuffer());
  } catch {
    return json({ error: "Не удалось прочитать файл. Попробуйте ещё раз или выберите другую картинку." }, 400);
  }
  if (!buffer.length) return json({ error: "Файл пришёл пустым. Попробуйте загрузить его ещё раз." }, 400);

  try {
    const saved = await saveUserBuffer({ userId: user.id, rubricId, kind, buffer, mimeType });
    return json({ file: { id: saved.id, url: filePublicPath(saved.id), kind: saved.kind } });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Не удалось сохранить файл" }, 400);
  }
}
