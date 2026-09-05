import { authed, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { loadStudio } from "@/lib/studio";
import { toRubric } from "@/lib/serializers";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { user, error } = await authed();
  if (error) return error;
  const { id } = await params;
  const existing = await prisma.rubric.findFirst({ where: { id, userId: user.id } });
  if (!existing) return json({ error: "Рубрика не найдена" }, 404);

  const body = await request.json().catch(() => null);
  const data: { name?: string; colors?: string[]; inspirationUrl?: string | null } = {};
  if (typeof body?.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (Array.isArray(body?.colors)) {
    data.colors = body.colors.filter((item: unknown) => typeof item === "string").slice(0, 4);
  }
  if (typeof body?.inspirationUrl === "string" || body?.inspirationUrl === null) {
    data.inspirationUrl = typeof body.inspirationUrl === "string"
      ? body.inspirationUrl.trim() || null
      : null;
  }

  const rubric = await prisma.rubric.update({
    where: { id },
    data,
    include: { templates: true, files: true },
  });
  return json({ rubric: toRubric(rubric) });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { user, error } = await authed();
  if (error) return error;
  const { id } = await params;
  const existing = await prisma.rubric.findFirst({ where: { id, userId: user.id } });
  if (!existing) return json({ error: "Рубрика не найдена" }, 404);
  await prisma.rubric.delete({ where: { id } });
  return json(await loadStudio(user.id));
}
