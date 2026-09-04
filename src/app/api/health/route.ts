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

  return json({
    ok: env.mailConfigured && database === "ok",
    mail: env.mailConfigured ? "ok" : "missing",
    database,
    appUrl: env.appUrl || null,
  });
}
