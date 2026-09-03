import { authed, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { isFormat, toWork } from "@/lib/serializers";

export async function POST(request: Request) {
  const { user, error } = await authed();
  if (error) return error;
  const body = await request.json().catch(() => null);
  if (!body?.work) return json({ error: "Нет работы" }, 400);

  const work = body.work as Record<string, unknown>;
  const format = String(work.format || "");
  const rubricId = String(work.rubricId || "");
  if (!isFormat(format)) return json({ error: "Неизвестный формат" }, 400);

  const rubric = await prisma.rubric.findFirst({ where: { id: rubricId, userId: user.id } });
  if (!rubric) return json({ error: "Рубрика не найдена" }, 404);

  const created = await prisma.work.create({
    data: {
      userId: user.id,
      rubricId,
      format,
      topic: String(work.topic || "Без темы"),
      slides: work.slides ?? [],
      caption: String(work.caption || ""),
      hashtags: work.hashtags ?? [],
      reelScript: typeof work.reelScript === "string" ? work.reelScript : null,
      layout: String(work.layout || "poster"),
      background: String(work.background || "#f6f1e9"),
      accent: String(work.accent || "#ff5c35"),
      foreground: String(work.foreground || "#191817"),
      eyebrow: String(work.eyebrow || ""),
      brandLabel: String(work.brandLabel || "postvmeste"),
    },
  });

  return json({ work: toWork(created) });
}
