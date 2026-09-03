import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "./db";
import type { FileKind } from "@prisma/client";

const ROOT = path.join(process.cwd(), "uploads");
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

function extFor(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export async function saveUserFile(input: {
  userId: string;
  rubricId?: string | null;
  kind: FileKind;
  file: File;
}) {
  if (!ALLOWED.has(input.file.type)) {
    throw new Error("Можно загрузить только PNG, JPEG или WEBP");
  }
  if (input.file.size > MAX_BYTES) {
    throw new Error("Файл больше 8 МБ");
  }

  const id = crypto.randomUUID();
  const ext = extFor(input.file.type);
  const objectKey = `${input.userId}/${id}.${ext}`;
  const abs = path.join(ROOT, objectKey);
  await mkdir(path.dirname(abs), { recursive: true });
  const buffer = Buffer.from(await input.file.arrayBuffer());
  await writeFile(abs, buffer);

  return prisma.fileAsset.create({
    data: {
      id,
      userId: input.userId,
      rubricId: input.rubricId || null,
      kind: input.kind,
      objectKey,
      mimeType: input.file.type,
      byteSize: buffer.length,
    },
  });
}

export async function readUserFile(objectKey: string) {
  const abs = path.join(ROOT, objectKey);
  return readFile(abs);
}

export async function deleteUserFile(id: string, userId: string) {
  const file = await prisma.fileAsset.findFirst({ where: { id, userId } });
  if (!file) return;
  await unlink(path.join(ROOT, file.objectKey)).catch(() => undefined);
  await prisma.fileAsset.delete({ where: { id } });
}

export function filePublicPath(id: string) {
  return `/api/files/${id}`;
}
