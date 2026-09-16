import { authed, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { RATE_RULES, rateLimit } from "@/lib/rate-limit";
import { isFormat, toWork } from "@/lib/serializers";
import { workFields } from "@/lib/work-input";

export async function POST(request: Request) {
  const { user, error } = await authed();
  if (error) return error;
  const limited = rateLimit("works", user.id, RATE_RULES.works);
  if (limited) return limited;
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
      ...workFields(work),
    },
  });

  return json({ work: toWork(created) });
}
