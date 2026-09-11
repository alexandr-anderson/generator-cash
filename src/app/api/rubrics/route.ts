import { authed, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { toRubric } from "@/lib/serializers";

export async function POST(request: Request) {
  const { user, error } = await authed();
  if (error) return error;
  const body = await request.json().catch(() => null);
  const name = String(body?.name || "").trim();
  if (!name) return json({ error: "Название рубрики обязательно" }, 400);

  const profileColors = Array.isArray(user.colors) ? (user.colors as string[]) : undefined;

  const rubric = await prisma.rubric.create({
    data: { userId: user.id, name, colors: profileColors },
    include: { files: true },
  });
  return json({ rubric: toRubric(rubric) });
}
