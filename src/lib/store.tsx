"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type {
  ArchiveItem,
  CreativeFormat,
  CreativeWork,
  Rubric,
  Subscription,
  Template,
  UserProfile,
} from "./types";
import type { ComposedCopy } from "./ai-types";
import type { CarouselRecipe } from "./carousel-recipe";
import { DETACHED_RUBRIC_LABEL } from "./rubric-copy";

type StudioPayload = {
  user: UserProfile | null;
  subscription: Subscription;
  remaining: number;
  total: number;
  rubrics: Rubric[];
  archive: ArchiveItem[];
  works: CreativeWork[];
};

type AppActions = {
  refresh: () => Promise<void>;
  register: (email: string, password: string, niche: string, consent?: boolean) => Promise<{ ok: boolean; error?: string; needsVerification?: boolean }>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string; needsVerification?: boolean }>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  markProfilePopupShown: () => Promise<void>;
  addRubric: (name: string) => Promise<Rubric | null>;
  updateRubric: (id: string, updates: Partial<Rubric>) => Promise<void>;
  deleteRubric: (id: string) => Promise<void>;
  saveTemplate: (rubricId: string, format: CreativeFormat, template: Template) => Promise<void>;
  addWork: (work: CreativeWork) => Promise<ArchiveItem | null>;
  deleteWork: (id: string) => Promise<void>;
  useGeneration: () => Promise<boolean>;
  draftText: (topic: string) => Promise<string>;
  draftReelHooks: (topic: string, authorHook?: string) => Promise<string[]>;
  composeCopy: (input: {
    format: CreativeFormat;
    topic: string;
    text: string;
    captionSource?: string;
    rubricId?: string | null;
    colors?: string[];
    referenceIds?: string[];
  }, onDelta?: (text: string) => void) => Promise<ComposedCopy & { carouselRecipe?: CarouselRecipe | null }>;
  expandCarousel: (
    input: { topic: string; text: string; scenario: string; firstSlide: string },
    onDelta?: (text: string) => void,
  ) => Promise<{
    slides: string[];
    caption: string;
    hashtags: string[];
  }>;
  uploadReference: (rubricId: string, file: File) => Promise<string | null>;
  deleteFile: (id: string) => Promise<void>;
  getGenerationsRemaining: () => number;
};

const emptySubscription: Subscription = {
  tier: "free",
  generationsPerWeek: 1,
  priceRub: 0,
  generationsUsed: 0,
  weekStartedAt: Date.now(),
  initialFreeRemaining: 5,
};

const StoreContext = createContext<(StudioPayload & AppActions & { ready: boolean }) | null>(null);

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers || {}) },
      credentials: "include",
    });
  } catch {
    // `fetch` отклоняется только на сетевом уровне: обрыв связи, таймаут соединения,
    // уснувшая вкладка. Наружу это уходило сырым «Failed to fetch» — по-английски и
    // бессмысленно для человека; поймано живой проверкой 2026-09-10 (п. 32, 47).
    //
    // Про лимит намеренно ничего не обещаем: связь могла оборваться уже после того,
    // как сервер досчитал и списал генерацию. Врать в извинении — хуже, чем молчать.
    throw Object.assign(
      new Error("Извините, связь с сервером оборвалась — ответ до нас не дошёл. Проверьте счётчик генераций и попробуйте ещё раз."),
      { status: 0 },
    );
  }
  const raw = await response.text();
  let data = {} as T & { error?: string };
  try {
    data = raw ? (JSON.parse(raw) as T & { error?: string }) : data;
  } catch {
    if (!response.ok) {
      throw Object.assign(
        new Error(
          response.status >= 500
            ? "Модель думала слишком долго. Нажмите «Создать» ещё раз."
            : "Ошибка запроса",
        ),
        { status: response.status },
      );
    }
  }
  if (!response.ok) {
    throw Object.assign(new Error(data.error || "Ошибка запроса"), { status: response.status, data });
  }
  return data;
}

/**
 * Читает NDJSON-ответ AI-роутов: строка `result` — итог, `error` — сорвалось,
 * `delta` — кусок текста от модели, который показываем как живой прогресс.
 *
 * Ошибки до обращения к модели (квота, лимиты, занятый слот) прилетают обычным
 * JSON с честным кодом — их разбираем как раньше, до чтения потока.
 */
async function apiStream<T>(
  url: string,
  body: unknown,
  onDelta?: (text: string) => void,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
  } catch {
    throw Object.assign(
      new Error("Извините, связь с сервером оборвалась — ответ до нас не дошёл. Проверьте счётчик генераций и попробуйте ещё раз."),
      { status: 0 },
    );
  }

  if (!response.ok || !response.body) {
    const raw = await response.text();
    let message = "Ошибка запроса";
    try {
      message = (JSON.parse(raw) as { error?: string }).error || message;
    } catch {
      if (response.status >= 500) message = "Модель думала слишком долго. Нажмите «Создать» ещё раз.";
    }
    throw Object.assign(new Error(message), { status: response.status });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: T | null = null;
  let failure: string | null = null;

  const handle = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let parsed: { type?: string; text?: string; error?: string };
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return; // одна битая строка не повод терять весь ответ
    }
    if (parsed.type === "delta" && parsed.text) onDelta?.(parsed.text);
    else if (parsed.type === "error") failure = parsed.error || "Ошибка запроса";
    else if (parsed.type === "result") result = parsed as unknown as T;
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut = buffer.indexOf("\n");
    while (cut !== -1) {
      handle(buffer.slice(0, cut));
      buffer = buffer.slice(cut + 1);
      cut = buffer.indexOf("\n");
    }
  }
  handle(buffer);

  if (failure) throw new Error(failure);
  if (!result) {
    // Поток кончился, а итога не было: связь оборвалась на полпути.
    throw new Error("Извините, ответ оборвался на полпути. Проверьте счётчик генераций и попробуйте ещё раз.");
  }
  return result;
}

function applyStudio(
  payload: Partial<StudioPayload> | null,
): Pick<StudioPayload, "user" | "subscription" | "remaining" | "total" | "rubrics" | "archive" | "works"> {
  return {
    user: payload?.user
      ? { ...payload.user, role: payload.user.role === "admin" ? "admin" : "user" }
      : null,
    subscription: payload?.subscription ?? emptySubscription,
    remaining: payload?.remaining ?? 0,
    total: payload?.total ?? 0,
    rubrics: payload?.rubrics ?? [],
    archive: payload?.archive ?? [],
    works: payload?.works ?? [],
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState(applyStudio(null));
  const [ready, setReady] = useState(false);

  const hydrate = useCallback(async () => {
    try {
      const payload = await api<StudioPayload>("/api/auth/me");
      setState(applyStudio(payload.user ? payload : null));
    } catch {
      setState(applyStudio(null));
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void hydrate();
  }, [hydrate]);

  const register = useCallback(async (email: string, password: string, niche: string, consent = false) => {
    try {
      const result = await api<{ ok: boolean; needsVerification?: boolean }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, niche, consent }),
      });
      return { ok: true, needsVerification: result.needsVerification };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Не удалось зарегистрироваться" };
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const payload = await api<StudioPayload>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setState(applyStudio(payload));
      return { ok: true };
    } catch (error) {
      const extra = error as Error & { data?: { needsVerification?: boolean } };
      return {
        ok: false,
        error: extra.message || "Неверная почта или пароль",
        needsVerification: extra.data?.needsVerification,
      };
    }
  }, []);

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setState(applyStudio(null));
  }, []);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    const payload = await api<StudioPayload>("/api/profile", {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    setState(applyStudio(payload));
  }, []);

  const markProfilePopupShown = useCallback(async () => {
    await updateProfile({ profilePopupShown: true });
  }, [updateProfile]);

  const addRubric = useCallback(async (name: string) => {
    const result = await api<{ rubric: Rubric }>("/api/rubrics", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    setState((current) => ({ ...current, rubrics: [result.rubric, ...current.rubrics] }));
    return result.rubric;
  }, []);

  const updateRubric = useCallback(async (id: string, updates: Partial<Rubric>) => {
    await api(`/api/rubrics/${id}`, { method: "PATCH", body: JSON.stringify(updates) });
    setState((current) => ({
      ...current,
      rubrics: current.rubrics.map((item) => (item.id === id ? { ...item, ...updates } : item)),
      archive:
        typeof updates.name === "string"
          ? current.archive.map((item) => (item.rubricId === id ? { ...item, rubricName: updates.name as string } : item))
          : current.archive,
    }));
  }, []);

  const deleteRubric = useCallback(async (id: string) => {
    const payload = await api<StudioPayload>(`/api/rubrics/${id}`, { method: "DELETE" });
    setState(applyStudio(payload));
  }, []);

  const saveTemplate = useCallback(async (rubricId: string, format: CreativeFormat, template: Template) => {
    await api(`/api/rubrics/${rubricId}/template`, {
      method: "POST",
      body: JSON.stringify({ format, ...template }),
    });
    setState((current) => ({
      ...current,
      rubrics: current.rubrics.map((item) =>
        item.id === rubricId ? { ...item, templates: { ...item.templates, [format]: template } } : item,
      ),
    }));
  }, []);

  const addWork = useCallback(async (work: CreativeWork) => {
    const result = await api<{ work: CreativeWork }>("/api/works", {
      method: "POST",
      body: JSON.stringify({ work }),
    });
    await hydrate();
    const created = result.work;
    return {
      id: `archive-${created.id}`,
      workId: created.id,
      format: created.format,
      rubricId: created.rubricId,
      rubricName: state.rubrics.find((item) => item.id === created.rubricId)?.name || DETACHED_RUBRIC_LABEL,
      topic: created.topic,
      previewSlide: created.slides[0],
      background: created.background,
      createdAt: created.createdAt,
    } satisfies ArchiveItem;
  }, [hydrate, state.rubrics]);

  const deleteWork = useCallback(async (id: string) => {
    const payload = await api<StudioPayload>(`/api/works/${id}`, { method: "DELETE" });
    setState(applyStudio(payload));
  }, []);

  const useGeneration = useCallback(async () => {
    try {
      const result = await api<{ remaining: number }>("/api/generations", { method: "POST" });
      setState((current) => ({ ...current, remaining: result.remaining }));
      return true;
    } catch {
      return false;
    }
  }, []);

  const draftText = useCallback(async (topic: string) => {
    const result = await api<{ text: string }>("/api/ai/text", {
      method: "POST",
      body: JSON.stringify({ topic }),
    });
    return result.text;
  }, []);

  const draftReelHooks = useCallback(async (topic: string, authorHook?: string) => {
    const result = await api<{ hooks: string[] }>("/api/ai/text", {
      method: "POST",
      body: JSON.stringify({ topic, format: "reel", text: authorHook || "" }),
    });
    return result.hooks || [];
  }, []);

  const composeCopy = useCallback(async (input: {
    format: CreativeFormat;
    topic: string;
    text: string;
    captionSource?: string;
    rubricId?: string | null;
    colors?: string[];
    referenceIds?: string[];
  }, onDelta?: (text: string) => void) => {
    const result = await apiStream<ComposedCopy & { remaining: number; carouselRecipe?: CarouselRecipe | null }>(
      "/api/ai/compose",
      input,
      onDelta,
    );
    setState((current) => ({
      ...current,
      remaining: result.remaining,
      rubrics: current.rubrics.map((item) =>
        item.id === input.rubricId
          ? { ...item, carouselRecipe: result.carouselRecipe ?? item.carouselRecipe }
          : item,
      ),
    }));
    return result;
  }, []);

  const uploadReference = useCallback(async (rubricId: string, file: File) => {
    // Raw binary body, not multipart/form-data — see the comment in
    // src/app/api/files/route.ts for why.
    const response = await fetch("/api/files", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": file.type,
        "x-file-kind": "reference",
        "x-rubric-id": rubricId,
      },
      body: file,
    });
    const data = await response.json().catch(() => ({})) as { error?: string; file?: { url: string } };
    if (!response.ok) {
      throw new Error(data.error || "Не удалось загрузить референс");
    }
    const url = data.file?.url;
    if (!url) return null;
    setState((current) => ({
      ...current,
      rubrics: current.rubrics.map((item) =>
        item.id === rubricId
          ? { ...item, references: [...(item.references || []), url].slice(0, 4), carouselRecipe: null }
          : item,
      ),
    }));
    return url;
  }, []);

  const deleteFile = useCallback(async (id: string) => {
    await api(`/api/files/${id}`, { method: "DELETE" });
    const path = `/api/files/${id}`;
    setState((current) => ({
      ...current,
      rubrics: current.rubrics.map((item) => ({
        ...item,
        references: (item.references || []).filter((url) => url !== path),
        carouselRecipe: (item.references || []).includes(path) ? null : item.carouselRecipe,
      })),
    }));
  }, []);

  const expandCarousel = useCallback(async (input: {
    topic: string;
    text: string;
    scenario: string;
    firstSlide: string;
  }, onDelta?: (text: string) => void) => {
    const result = await apiStream<{ slides: string[]; caption: string; hashtags: string[]; remaining: number }>(
      "/api/ai/expand",
      input,
      onDelta,
    );
    setState((current) => ({ ...current, remaining: result.remaining }));
    return {
      slides: result.slides,
      caption: result.caption,
      hashtags: result.hashtags,
    };
  }, []);

  const getGenerationsRemaining = useCallback(() => state.remaining, [state.remaining]);

  const lockToSession = pathname.startsWith("/dashboard") || pathname.startsWith("/admin");
  if (!ready && lockToSession) {
    return <div className="loading-screen"><div className="loading-spinner" /></div>;
  }

  return (
    <StoreContext.Provider
      value={{
        ...state,
        ready,
        refresh: hydrate,
        register,
        login,
        logout,
        updateProfile,
        markProfilePopupShown,
        addRubric,
        updateRubric,
        deleteRubric,
        saveTemplate,
        addWork,
        deleteWork,
        useGeneration,
        draftText,
        draftReelHooks,
        composeCopy,
        expandCarousel,
        uploadReference,
        deleteFile,
        getGenerationsRemaining,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
