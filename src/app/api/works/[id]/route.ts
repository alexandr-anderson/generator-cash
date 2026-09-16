import { authed, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { RATE_RULES, rateLimit } from "@/lib/rate-limit";
import { toWork } from "@/lib/serializers";
import { loadStudio } from "@/lib/studio";
import { workFields } from "@/lib/work-input";

type Params = { params: Promise<{ id: string }> };

/**
 * Обновление уже сохранённой работы — автосохранение из редактора (п. 48).
 * Раньше второй экспорт делал второй `create`, и в архиве появлялся дубль.
 */
export async function PUT(request: Request, { params }: Params) {
  const { user, error } = await authed();
  if (error) return error;
  const limited = rateLimit("works", user.id, RATE_RULES.works);
  if (limited) return limited;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body?.work) return json({ error: "Нет работы" }, 400);

  const existing = await prisma.work.findFirst({ where: { id, userId: user.id } });
  if (!existing) return json({ error: "Работа не найдена" }, 404);

  const updated = await prisma.work.update({
    where: { id },
    data: workFields(body.work as Record<string, unknown>),
  });
  return json({ work: toWork(updated) });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { user, error } = await authed();
  if (error) return error;
  const { id } = await params;
  const existing = await prisma.work.findFirst({ where: { id, userId: user.id } });
  if (!existing) return json({ error: "Работа не найдена" }, 404);
  await prisma.work.delete({ where: { id } });
  return json(await loadStudio(user.id));
}
