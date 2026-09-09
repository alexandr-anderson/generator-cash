import { Readable } from "node:stream";
import Busboy from "busboy";

export type ParsedMultipartFile = {
  fieldName: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
};

export type ParsedMultipart = {
  fields: Record<string, string>;
  files: ParsedMultipartFile[];
};

// Node's built-in `request.formData()` (undici) has a long-standing bug parsing
// multipart bodies — throws "TypeError: Failed to parse body as FormData" on
// otherwise valid requests depending on the Node patch version. Parsing the
// body ourselves with busboy sidesteps it regardless of the server's Node
// version. See https://github.com/nodejs/undici/issues/3676.
export async function parseMultipartForm(
  request: Request,
  options?: { maxFileBytes?: number },
): Promise<ParsedMultipart> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new Error("Ожидался multipart/form-data");
  }
  if (!request.body) {
    return { fields: {}, files: [] };
  }

  return new Promise<ParsedMultipart>((resolve, reject) => {
    const fields: Record<string, string> = {};
    const files: ParsedMultipartFile[] = [];
    let failed = false;

    const busboy = Busboy({
      headers: { "content-type": contentType },
      limits: options?.maxFileBytes ? { fileSize: options.maxFileBytes } : undefined,
    });

    busboy.on("field", (name, value) => {
      fields[name] = value;
    });

    busboy.on("file", (name, stream, info) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("limit", () => {
        failed = true;
        reject(new Error("Файл больше допустимого размера"));
        stream.resume();
      });
      stream.on("end", () => {
        if (failed) return;
        files.push({
          fieldName: name,
          filename: info.filename,
          mimeType: info.mimeType,
          buffer: Buffer.concat(chunks),
        });
      });
    });

    busboy.on("error", (err) => {
      failed = true;
      reject(err instanceof Error ? err : new Error(String(err)));
    });

    busboy.on("finish", () => {
      if (!failed) resolve({ fields, files });
    });

    Readable.fromWeb(request.body as import("node:stream/web").ReadableStream).pipe(busboy);
  });
}
