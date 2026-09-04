"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
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
  register: (email: string, password: string, niche: string) => Promise<{ ok: boolean; error?: string; needsVerification?: boolean }>;
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
  composeCopy: (input: { format: CreativeFormat; topic: string; text: string }) => Promise<ComposedCopy>;
  getGenerationsRemaining: () => number;
  upgradeTier: (tier: Subscription["tier"]) => Promise<void>;
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
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
    credentials: "include",
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw Object.assign(new Error(data.error || "Ошибка запроса"), { status: response.status, data });
  }
  return data;
}

function applyStudio(
  payload: Partial<StudioPayload> | null,
): Pick<StudioPayload, "user" | "subscription" | "remaining" | "total" | "rubrics" | "archive" | "works"> {
  return {
    user: payload?.user ?? null,
    subscription: payload?.subscription ?? emptySubscription,
    remaining: payload?.remaining ?? 0,
    total: payload?.total ?? 0,
    rubrics: payload?.rubrics ?? [],
    archive: payload?.archive ?? [],
    works: payload?.works ?? [],
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
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

  const register = useCallback(async (email: string, password: string, niche: string) => {
    try {
      const result = await api<{ ok: boolean; needsVerification?: boolean }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, niche }),
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
      rubricName: state.rubrics.find((item) => item.id === created.rubricId)?.name || "",
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

  const composeCopy = useCallback(async (input: { format: CreativeFormat; topic: string; text: string }) => {
    const result = await api<ComposedCopy & { remaining: number }>("/api/ai/compose", {
      method: "POST",
      body: JSON.stringify(input),
    });
    setState((current) => ({ ...current, remaining: result.remaining }));
    return result;
  }, []);

  const getGenerationsRemaining = useCallback(() => state.remaining, [state.remaining]);

  const upgradeTier = useCallback(async (tier: Subscription["tier"]) => {
    const payload = await api<StudioPayload>("/api/usage/tier", {
      method: "POST",
      body: JSON.stringify({ tier }),
    });
    setState(applyStudio(payload));
  }, []);

  if (!ready) {
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
        composeCopy,
        getGenerationsRemaining,
        upgradeTier,
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
