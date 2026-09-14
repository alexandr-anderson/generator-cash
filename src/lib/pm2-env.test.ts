import { readdirSync, readFileSync, statSync } from "fs";
import { createRequire } from "module";
import path from "path";
import { describe, expect, it } from "vitest";

/**
 * PM2 передаёт приложению не весь .env, а только ключи из `env` в
 * ecosystem.config.cjs. Переменная, которой там нет, в проде молча пуста:
 * 2026-09-14 так не доехали `IMAGE_FALLBACK_*`, и запасной шлюз картинок
 * ни разу не включился, хотя деплой честно записал секреты в .env.
 */

// Уже известные расхождения — осознанно, а не по забывчивости.
const NOT_FROM_PM2 = new Set([
  "NEXT_RUNTIME", // выставляет сам Next.js
  "NODE_ENV", // есть в списке, но выставляется и Next.js
  "OPENAI_IMAGE_ENDPOINT", // старое имя OPENAI_IMAGE_BASE_URL, запасной вариант
  "ADMIN_EMAILS", // на проде админ задан ролью в БД; до п. 50 не передавался
  "SMTP_PASS", // старое имя ключа почты, в проде RESEND_API_KEY
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("ecosystem.config.cjs", () => {
  it("передаёт приложению все переменные окружения, которые читает код", () => {
    const root = process.cwd();
    const config = createRequire(import.meta.url)(path.join(root, "ecosystem.config.cjs")) as {
      apps: Array<{ env: Record<string, string> }>;
    };
    const passed = new Set(Object.keys(config.apps[0].env));

    const used = new Set<string>();
    for (const file of sourceFiles(path.join(root, "src"))) {
      for (const match of readFileSync(file, "utf8").matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
        used.add(match[1]);
      }
    }

    const missing = [...used].filter((key) => !passed.has(key) && !NOT_FROM_PM2.has(key)).sort();
    expect(missing).toEqual([]);
  });
});
