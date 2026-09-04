import { authed, json } from "@/lib/http";
import { saveUserFile } from "@/lib/storage";
import { filePublicPath } from "@/lib/storage";
import type { FileKind } from "@prisma/client";

const KINDS = new Set<FileKind>(["logo", "reference", "photo", "export"]);

export async function POST(request: Request) {
  const { user, error } = await authed();
  if (error) return error;

  const form = await request.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") || "reference") as FileKind;
  const rubricId = String(form.get("rubricId") || "") || null;
  if (!(file instanceof File)) return json({ error: "Нет файла" }, 400);
  if (!KINDS.has(kind)) return json({ error: "Неизвестный тип файла" }, 400);

  try {
    const saved = await saveUserFile({ userId: user.id, rubricId, kind, file });
    return json({ file: { id: saved.id, url: filePublicPath(saved.id), kind: saved.kind } });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Не удалось сохранить файл" }, 400);
  }
}
