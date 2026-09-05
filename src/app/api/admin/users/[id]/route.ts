import { buildAdminUpdates, parseAdminUserPatch, toAdminUserRow } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { authedAdmin, json } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { user, error } = await authedAdmin();
  if (error) return error;
  if (!user) return json({ error: "Нужно войти" }, 401);

  const { id } = await params;
  const parsed = parseAdminUserPatch(await request.json().catch(() => null));
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const target = await prisma.user.findUnique({
    where: { id },
    include: { usage: true },
  });
  if (!target) return json({ error: "Пользователь не найден" }, 404);

  const planned = buildAdminUpdates({
    patch: parsed.patch,
    target: { id: target.id, role: target.role },
    actorId: user.id,
  });
  if (!planned.ok) return json({ error: planned.error }, 400);

  if (Object.keys(planned.userData).length > 0) {
    await prisma.user.update({ where: { id }, data: planned.userData });
  }

  if (Object.keys(planned.usageData).length > 0) {
    if (!target.usage) {
      await prisma.usageState.create({ data: { userId: id } });
    }
    await prisma.usageState.update({
      where: { userId: id },
      data: planned.usageData,
    });
  }

  if (planned.revokeSessions) {
    await prisma.session.deleteMany({ where: { userId: id } });
  }

  const next = await prisma.user.findUnique({
    where: { id },
    include: { usage: true },
  });
  if (!next) return json({ error: "Пользователь не найден" }, 404);
  return json({ user: toAdminUserRow(next) });
}
