import { describe, expect, it } from "vitest";
import { readStreamedContent } from "./openai";

/** Собирает Response с телом-потоком из заранее нарезанных кусков сети. */
function sse(chunks: string[], contentType = "text/event-stream"): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { headers: { "content-type": contentType } });
}

function delta(content: string) {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n`;
}

describe("readStreamedContent", () => {
  it("склеивает дельты в один текст", async () => {
    const out = await readStreamedContent(sse([delta("Привет"), delta(", мир"), "data: [DONE]\n"]));
    expect(out).toBe("Привет, мир");
  });

  it("переживает кусок, разрезанный посередине строки", async () => {
    const line = delta("Выгорание");
    const cut = Math.floor(line.length / 2);
    const out = await readStreamedContent(sse([line.slice(0, cut), line.slice(cut), "data: [DONE]\n"]));
    expect(out).toBe("Выгорание");
  });

  it("переживает разрез посередине многобайтовой буквы", async () => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(delta("Ёж"));
    const head = bytes.slice(0, 30);
    const tail = bytes.slice(30);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(head);
        controller.enqueue(tail);
        controller.close();
      },
    });
    const out = await readStreamedContent(
      new Response(body, { headers: { "content-type": "text/event-stream" } }),
    );
    expect(out).toBe("Ёж");
  });

  it("зовёт onDelta по мере поступления, а не одним куском в конце", async () => {
    const seen: string[] = [];
    await readStreamedContent(sse([delta("раз"), delta("два"), "data: [DONE]\n"]), (c) => seen.push(c));
    expect(seen).toEqual(["раз", "два"]);
  });

  it("пропускает битую строку, не теряя остальной ответ", async () => {
    const out = await readStreamedContent(
      sse([delta("до"), "data: {это не json}\n", delta("после"), "data: [DONE]\n"]),
    );
    expect(out).toBe("допосле");
  });

  it("понимает обычный JSON, если шлюз проигнорировал stream", async () => {
    const payload = JSON.stringify({ choices: [{ message: { content: "целиком" } }] });
    const out = await readStreamedContent(
      new Response(payload, { headers: { "content-type": "application/json" } }),
    );
    expect(out).toBe("целиком");
  });
});
