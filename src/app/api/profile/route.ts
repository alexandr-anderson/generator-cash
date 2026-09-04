import { authed, json } from "@/lib/http";
import { prisma } from "@/lib/db";
import { loadStudio } from "@/lib/studio";
import { TONES } from "@/lib/types";

export async function PATCH(request: Request) {
  const { user, error } = await authed();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const data: {
    niche?: string;
    audience?: string | null;
    tone?: string | null;
    colors?: string[];
    profileCompleted?: boolean;
    profilePopupShown?: boolean;
    logoFileId?: string | null;
  } = {};

  if (typeof body?.niche === "string" && body.niche.trim()) data.niche = body.niche.trim();
  if (typeof body?.audience === "string") data.audience = body.audience.trim() || null;
  if (typeof body?.tone === "string") {
    data.tone = TONES.includes(body.tone) || body.tone === "" ? (body.tone || null) : body.tone;
  }
  if (Array.isArray(body?.colors)) {
    data.colors = body.colors.filter((item: unknown) => typeof item === "string").slice(0, 4);
  }
  if (typeof body?.profileCompleted === "boolean") data.profileCompleted = body.profileCompleted;
  if (typeof body?.profilePopupShown === "boolean") data.profilePopupShown = body.profilePopupShown;
  if (typeof body?.logoFileId === "string" || body?.logoFileId === null) data.logoFileId = body.logoFileId;

  await prisma.user.update({ where: { id: user.id }, data });
  return json(await loadStudio(user.id));
}
