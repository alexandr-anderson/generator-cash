import { authed, json } from "@/lib/http";
import { SELF_SERVE_TIER_ERROR } from "@/lib/billing";

export async function POST() {
  const { error } = await authed();
  if (error) return error;
  return json({ error: SELF_SERVE_TIER_ERROR }, 403);
}
