import { userIsAdmin } from "@/lib/admin";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { json } from "@/lib/http";
import { runtimeStatus } from "@/lib/runtime-status";

export async function GET() {
  const env = runtimeStatus();
  let database: "ok" | "error" | "unset" = env.databaseConfigured ? "ok" : "unset";
  if (env.databaseConfigured) {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      database = "error";
      console.error("[health] database ping failed", error);
    }
  }

  // Public payload stays at what scripts/uptime-check.js reads. Gateway hosts,
  // model names and appUrl are recon material for an unauthenticated caller,
  // so they are admin-only.
  const publicPayload = {
    ok: env.mailConfigured && database === "ok",
    mail: env.mailConfigured ? "ok" : "missing",
    database,
    ai: env.openaiConfigured ? "ok" : "missing",
    image: env.openaiImageConfigured ? "ok" : "missing",
  };

  const user = await getSessionUser().catch(() => null);
  if (!user || !userIsAdmin(user)) return json(publicPayload);

  return json({
    ...publicPayload,
    aiHost: env.openaiHost,
    textModel: env.openaiModel || null,
    imageHost: env.openaiImageHost || null,
    imageModel: env.openaiImageModel,
    appUrl: env.appUrl || null,
    nodeEnv: env.nodeEnv || null,
  });
}
