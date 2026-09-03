import { authed, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { readUserFile } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { user, error } = await authed();
  if (error) return error;
  const { id } = await params;
  const file = await prisma.fileAsset.findFirst({ where: { id, userId: user.id } });
  if (!file) return json({ error: "Файл не найден" }, 404);
  try {
    const buffer = await readUserFile(file.objectKey);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "content-type": file.mimeType,
        "content-length": String(buffer.length),
        "cache-control": "private, max-age=3600",
      },
    });
  } catch {
    return json({ error: "Файл отсутствует на диске" }, 404);
  }
}
