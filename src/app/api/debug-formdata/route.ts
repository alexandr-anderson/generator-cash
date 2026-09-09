import { authedAdmin, json } from "@/lib/http";
import { parseMultipartForm } from "@/lib/multipart";

// TEMPORARY diagnostic route — not linked from any UI, admin-only.
// Remove once the /api/files multipart crash is understood and fixed.
export async function POST(request: Request) {
  const { error } = await authedAdmin();
  if (error) return error;

  const contentLength = request.headers.get("content-length");
  const contentType = request.headers.get("content-type");

  // Clone so we can drain the raw body independently of busboy, to see
  // whether the Request's own body stream is already short.
  const clone = request.clone();
  let rawBytes = -1;
  let rawError: string | null = null;
  try {
    const buf = await clone.arrayBuffer();
    rawBytes = buf.byteLength;
  } catch (err) {
    rawError = err instanceof Error ? err.message : String(err);
  }

  let parsed: unknown = null;
  let parseError: string | null = null;
  try {
    const form = await parseMultipartForm(request, { maxFileBytes: 8 * 1024 * 1024 });
    parsed = {
      fields: form.fields,
      files: form.files.map((f) => ({ filename: f.filename, mimeType: f.mimeType, bytes: f.buffer.length })),
    };
  } catch (err) {
    parseError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }

  return json({ contentLength, contentType, rawBytes, rawError, parsed, parseError });
}
