import { authed, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { isFormat, toRubric } from "@/lib/serializers";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { user, error } = await authed();
  if (error) return error;
  const { id } = await params;
  const rubric = await prisma.rubric.findFirst({ where: { id, userId: user.id } });
  if (!rubric) return json({ error: "Рубрика не найдена" }, 404);

  const body = await request.json().catch(() => null);
  const format = String(body?.format || "");
  if (!isFormat(format)) return json({ error: "Неизвестный формат" }, 400);

  const template = {
    layout: String(body?.layout || "poster"),
    scenario: String(body?.scenario || ""),
    decorStyle: String(body?.decorStyle || "geometric"),
    font: String(body?.font || "Arial"),
    colors: Array.isArray(body?.colors) ? body.colors : [],
    slideCount: Number(body?.slideCount) || (format === "carousel" ? 7 : 1),
  };

  await prisma.rubricTemplate.upsert({
    where: { rubricId_format: { rubricId: id, format } },
    create: { rubricId: id, format, ...template },
    update: template,
  });

  const next = await prisma.rubric.findUniqueOrThrow({
    where: { id },
    include: { templates: true, files: true },
  });
  return json({ rubric: toRubric(next) });
}
