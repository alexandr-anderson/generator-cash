import { authedAdmin, json } from "@/lib/http";

// TEMPORARY diagnostic route — not linked from any UI, admin-only.
// Remove once the /api/files multipart crash is understood and fixed.
export async function POST(request: Request) {
  const { error } = await authedAdmin();
  if (error) return error;
  try {
    const form = await request.formData();
    return json({ ok: true, keys: Array.from(form.keys()) });
  } catch (err) {
    return json(
      {
        ok: false,
        name: err instanceof Error ? err.name : typeof err,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      200,
    );
  }
}
