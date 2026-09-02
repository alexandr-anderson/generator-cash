import {
  measureReference,
  type PixelBuffer,
  type ReferenceSignals,
} from "./brand-analysis";

function rasterizeWithImage(file: File): Promise<PixelBuffer> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        resolve(drawToBuffer(image, image.naturalWidth || image.width, image.naturalHeight || image.height));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Не удалось прочитать ${file.name}`));
    };
    image.src = url;
  });
}

function drawToBuffer(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): PixelBuffer {
  const maxEdge = 72;
  const scale = Math.min(maxEdge / sourceWidth, maxEdge / sourceHeight, 1);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Canvas 2D is unavailable");
  }
  context.drawImage(source, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);
  return { width, height, data };
}

export async function readReferenceSignals(file: File): Promise<ReferenceSignals> {
  const descriptor = { name: file.name, type: file.type, size: file.size };
  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file);
      try {
        return measureReference(
          descriptor,
          drawToBuffer(bitmap, bitmap.width, bitmap.height),
        );
      } finally {
        bitmap.close();
      }
    }
  } catch {
    // Fall through to HTMLImageElement for browsers/codecs that reject ImageBitmap.
  }

  return measureReference(descriptor, await rasterizeWithImage(file));
}
