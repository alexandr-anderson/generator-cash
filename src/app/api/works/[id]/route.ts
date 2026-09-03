import { authed, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { loadStudio } from "@/lib/studio";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const { user, error } = await authed();
  if (error) return error;
  const { id } = await params;
  const existing = await prisma.work.findFirst({ where: { id, userId: user.id } });
  if (!existing) return json({ error: "Работа не найдена" }, 404);
  await prisma.work.delete({ where: { id } });
  return json(await loadStudio(user.id));
}
