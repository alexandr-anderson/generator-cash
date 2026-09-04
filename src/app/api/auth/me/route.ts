import { getSessionUser } from "@/lib/auth";
import { json } from "@/lib/http";
import { loadStudio } from "@/lib/studio";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return json({ user: null }, 200);
    const studio = await loadStudio(user.id);
    return json(studio);
  } catch (error) {
    console.error("[auth/me] failed", error);
    return json({ user: null }, 200);
  }
}
