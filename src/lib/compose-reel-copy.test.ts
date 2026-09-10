import { beforeEach, describe, expect, it, vi } from "vitest";

const openaiJson = vi.fn();

vi.mock("./openai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./openai")>();
  return { ...actual, openaiJson: (...args: unknown[]) => openaiJson(...args) };
});

const { composeReelCopy } = await import("./ai-copy");

/** Кто именно спрашивает — видно по промпту. */
const isCaptionCall = (user: string) => user.includes("Напиши подпись к Reels");

type Call = { kind: "hooks" | "caption"; startedAt: number; endedAt: number };

let calls: Call[] = [];

/** Каждый ответ занимает время — иначе одновременность не отличить от очереди. */
function respondAfter(ms: number) {
  openaiJson.mockImplementation(async (args: { user: string }) => {
    const kind = isCaptionCall(args.user) ? "caption" : "hooks";
    const startedAt = Date.now();
    await new Promise((resolve) => setTimeout(resolve, ms));
    calls.push({ kind, startedAt, endedAt: Date.now() });
    return kind === "caption"
      ? { caption: "Подпись от модели" }
      : { hooks: ["Первый хук", "Второй хук", "Третий хук"] };
  });
}

const base = { topic: "Выгорание", niche: "психология" };

describe("composeReelCopy", () => {
  beforeEach(() => {
    calls = [];
    openaiJson.mockReset();
  });

  it("со своим хуком автора спрашивает хуки и подпись одновременно", async () => {
    respondAfter(60);
    await composeReelCopy({ ...base, authorHook: "Хук автора" });

    expect(calls).toHaveLength(2);
    const [first, second] = calls.sort((a, b) => a.startedAt - b.startedAt);
    // Второй заход начался до того, как закончился первый — это и есть параллельность.
    expect(second.startedAt).toBeLessThan(first.endedAt);
  });

  it("без хука автора идёт последовательно: подписи нужен первый хук", async () => {
    respondAfter(60);
    await composeReelCopy({ ...base });

    expect(calls).toHaveLength(2);
    const hooks = calls.find((c) => c.kind === "hooks")!;
    const caption = calls.find((c) => c.kind === "caption")!;
    expect(caption.startedAt).toBeGreaterThanOrEqual(hooks.endedAt);
  });

  it("с готовой подписью автора модель за подписью не ходит вовсе", async () => {
    respondAfter(1);
    const copy = await composeReelCopy({ ...base, captionSource: "Подпись автора" });

    expect(calls.map((c) => c.kind)).toEqual(["hooks"]);
    expect(copy.caption).toBe("Подпись автора");
  });

  it("не теряет хуки автора при параллельном заходе", async () => {
    respondAfter(1);
    const copy = await composeReelCopy({ ...base, authorHook: "Хук автора" });

    expect(copy.caption).toBe("Подпись от модели");
    expect(copy.scenarios).toHaveLength(3);
    expect(copy.scenarios[0].slides[0]).toBe("Хук автора");
  });
});
