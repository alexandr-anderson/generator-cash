import { authed, json } from "@/lib/http";
import { parseMultipartForm } from "@/lib/multipart";
import { filePublicPath, MAX_UPLOAD_BYTES, saveUserBuffer } from "@/lib/storage";
import type { FileKind } from "@prisma/client";

const KINDS = new Set<FileKind>(["logo", "reference", "photo", "export"]);

export async function POST(request: Request) {
  const { user, error } = await authed();
  if (error) return error;

  let form: Awaited<ReturnType<typeof parseMultipartForm>>;
  try {
    form = await parseMultipartForm(request, { maxFileBytes: MAX_UPLOAD_BYTES });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Не удалось разобрать запрос" }, 400);
  }

  const file = form.files.find((item) => item.fieldName === "file");
  const kind = (form.fields.kind || "reference") as FileKind;
  const rubricId = form.fields.rubricId || null;
  if (!file) return json({ error: "Нет файла" }, 400);
  if (!KINDS.has(kind)) return json({ error: "Неизвестный тип файла" }, 400);

  try {
    const saved = await saveUserBuffer({
      userId: user.id,
      rubricId,
      kind,
      buffer: file.buffer,
      mimeType: file.mimeType,
    });
    return json({ file: { id: saved.id, url: filePublicPath(saved.id), kind: saved.kind } });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Не удалось сохранить файл" }, 400);
  }
}
