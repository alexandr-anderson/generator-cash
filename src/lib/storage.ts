import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "./db";
import { Prisma, type FileKind } from "@prisma/client";

const ROOT = path.join(process.cwd(), "uploads");
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

function extFor(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export async function saveUserBuffer(input: {
  userId: string;
  rubricId?: string | null;
  kind: FileKind;
  buffer: Buffer;
  mimeType: string;
}) {
  if (!ALLOWED.has(input.mimeType)) {
    throw new Error("Можно загрузить только PNG, JPEG или WEBP");
  }
  return persistBuffer({
    userId: input.userId,
    rubricId: input.rubricId,
    kind: input.kind,
    mimeType: input.mimeType,
    buffer: input.buffer,
  });
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
  return persistBuffer({
    userId: input.userId,
    rubricId: input.rubricId,
    kind: input.kind,
    mimeType: input.file.type,
    buffer: Buffer.from(await input.file.arrayBuffer()),
  });
}

async function persistBuffer(input: {
  userId: string;
  rubricId?: string | null;
  kind: FileKind;
  mimeType: string;
  buffer: Buffer;
}) {
  const id = crypto.randomUUID();
  const objectKey = `${input.userId}/${id}.${extFor(input.mimeType)}`;
  const abs = path.join(ROOT, objectKey);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, input.buffer);

  const saved = await prisma.fileAsset.create({
    data: {
      id,
      userId: input.userId,
      rubricId: input.rubricId || null,
      kind: input.kind,
      objectKey,
      mimeType: input.mimeType,
      byteSize: input.buffer.length,
    },
  });
  if (input.kind === "reference" && input.rubricId) {
    await clearRubricCarouselRecipe(input.userId, input.rubricId);
  }
  return saved;
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
  if (file.kind === "reference" && file.rubricId) {
    await clearRubricCarouselRecipe(userId, file.rubricId);
  }
}

export async function clearRubricCarouselRecipe(userId: string, rubricId: string) {
  await prisma.rubric.updateMany({
    where: { id: rubricId, userId },
    data: { carouselRecipe: Prisma.DbNull },
  });
}

export function filePublicPath(id: string) {
  return `/api/files/${id}`;
}
