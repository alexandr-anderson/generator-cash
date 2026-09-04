import { prisma } from "./db";
import { studioPayload } from "./serializers";

export async function loadStudio(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      usage: true,
      rubrics: { include: { templates: true, files: true }, orderBy: { createdAt: "desc" } },
      works: { include: { rubric: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!user) return null;
  return studioPayload({
    user,
    usage: user.usage,
    rubrics: user.rubrics,
    works: user.works,
  });
}
