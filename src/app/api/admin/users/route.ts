import { adminUserWhere, parseAdminUserQuery, toAdminUserRow } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { authedAdmin, json } from "@/lib/http";

export async function GET(request: Request) {
  const { error } = await authedAdmin();
  if (error) return error;

  const query = parseAdminUserQuery(new URL(request.url).searchParams);
  const where = adminUserWhere(query);

  const [users, total, paid, banned, registered] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { usage: true },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.user.count({ where }),
    prisma.user.count({ where: { bannedAt: null, usage: { tier: { not: "free" } } } }),
    prisma.user.count({ where: { bannedAt: { not: null } } }),
    prisma.user.count(),
  ]);

  return json({
    users: users.map(toAdminUserRow),
    total,
    page: query.page,
    pageSize: query.pageSize,
    stats: { registered, paid, banned },
  });
}
