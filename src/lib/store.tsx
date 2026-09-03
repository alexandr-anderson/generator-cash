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

type AppState = {
  user: UserProfile | null;
  subscription: Subscription;
  rubrics: Rubric[];
  archive: ArchiveItem[];
  works: CreativeWork[];
};

type AppActions = {
  register: (email: string, password: string, niche: string) => void;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  markProfilePopupShown: () => void;
  addRubric: (name: string) => Rubric;
  updateRubric: (id: string, updates: Partial<Rubric>) => void;
  deleteRubric: (id: string) => void;
  saveTemplate: (rubricId: string, format: CreativeFormat, template: Template) => void;
  addWork: (work: CreativeWork) => ArchiveItem;
  deleteWork: (id: string) => void;
  useGeneration: () => boolean;
  getGenerationsRemaining: () => number;
  upgradeTier: (tier: Subscription["tier"]) => void;
};

const StoreContext = createContext<(AppState & AppActions) | null>(null);

const STORAGE_KEY = "postvmeste_state";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function defaultSubscription(): Subscription {
  return {
    tier: "free",
    generationsPerWeek: 1,
    priceRub: 0,
    generationsUsed: 0,
    weekStartedAt: Date.now(),
    initialFreeRemaining: 5,
  };
}

function loadState(): AppState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(state: AppState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota exceeded
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    user: null,
    subscription: defaultSubscription(),
    rubrics: [],
    archive: [],
    works: [],
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = loadState();
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(saved);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveState(state);
  }, [state, hydrated]);

  const update = useCallback((fn: (prev: AppState) => AppState) => {
    setState((prev) => fn(prev));
  }, []);

  const register = useCallback((email: string, _pw: string, niche: string) => {
    update((s) => ({
      ...s,
      user: {
        id: crypto.randomUUID(),
        email,
        niche,
        profileCompleted: false,
        profilePopupShown: false,
      },
      subscription: defaultSubscription(),
    }));
  }, [update]);

  const login = useCallback((email: string, _pw: string) => {
    if (state.user?.email === email) return true;
    return false;
  }, [state.user]);

  const logout = useCallback(() => {
    update((s) => ({ ...s, user: null }));
  }, [update]);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    update((s) => {
      if (!s.user) return s;
      return { ...s, user: { ...s.user, ...updates } };
    });
  }, [update]);

  const markProfilePopupShown = useCallback(() => {
    update((s) => {
      if (!s.user) return s;
      return { ...s, user: { ...s.user, profilePopupShown: true } };
    });
  }, [update]);

  const addRubric = useCallback((name: string): Rubric => {
    const rubric: Rubric = {
      id: crypto.randomUUID(),
      name,
      createdAt: Date.now(),
    };
    update((s) => ({ ...s, rubrics: [...s.rubrics, rubric] }));
    return rubric;
  }, [update]);

  const updateRubric = useCallback((id: string, updates: Partial<Rubric>) => {
    update((s) => ({
      ...s,
      rubrics: s.rubrics.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    }));
  }, [update]);

  const deleteRubric = useCallback((id: string) => {
    update((s) => ({ ...s, rubrics: s.rubrics.filter((r) => r.id !== id) }));
  }, [update]);

  const saveTemplate = useCallback((rubricId: string, format: CreativeFormat, template: Template) => {
    update((s) => ({
      ...s,
      rubrics: s.rubrics.map((r) =>
        r.id === rubricId
          ? { ...r, templates: { ...r.templates, [format]: template } }
          : r,
      ),
    }));
  }, [update]);

  const addWork = useCallback((work: CreativeWork): ArchiveItem => {
    const rubric = state.rubrics.find((r) => r.id === work.rubricId);
    const item: ArchiveItem = {
      id: crypto.randomUUID(),
      workId: work.id,
      format: work.format,
      rubricId: work.rubricId,
      rubricName: rubric?.name || "",
      topic: work.topic,
      previewSlide: work.slides[0],
      background: work.background,
      createdAt: work.createdAt,
    };
    update((s) => ({
      ...s,
      works: [...s.works, work],
      archive: [item, ...s.archive],
    }));
    return item;
  }, [update, state.rubrics]);

  const deleteWork = useCallback((id: string) => {
    update((s) => ({
      ...s,
      works: s.works.filter((w) => w.id !== id),
      archive: s.archive.filter((a) => a.workId !== id),
    }));
  }, [update]);

  const getGenerationsRemaining = useCallback(() => {
    const sub = state.subscription;
    if (sub.initialFreeRemaining > 0) return sub.initialFreeRemaining;
    const elapsed = Date.now() - sub.weekStartedAt;
    if (elapsed >= WEEK_MS) return sub.generationsPerWeek;
    return Math.max(0, sub.generationsPerWeek - sub.generationsUsed);
  }, [state.subscription]);

  const useGeneration = useCallback(() => {
    let success = false;
    update((s) => {
      const sub = { ...s.subscription };
      if (sub.initialFreeRemaining > 0) {
        sub.initialFreeRemaining -= 1;
        success = true;
        return { ...s, subscription: sub };
      }
      const elapsed = Date.now() - sub.weekStartedAt;
      if (elapsed >= WEEK_MS) {
        sub.weekStartedAt = Date.now();
        sub.generationsUsed = 1;
        success = true;
        return { ...s, subscription: sub };
      }
      if (sub.generationsUsed < sub.generationsPerWeek) {
        sub.generationsUsed += 1;
        success = true;
        return { ...s, subscription: sub };
      }
      return s;
    });
    return success;
  }, [update]);

  const upgradeTier = useCallback((tier: Subscription["tier"]) => {
    const tiers: Record<string, { gen: number; price: number }> = {
      free: { gen: 1, price: 0 },
      starter: { gen: 10, price: 50 },
      pro: { gen: 50, price: 200 },
      business: { gen: 100, price: 500 },
    };
    const t = tiers[tier] || tiers.free;
    update((s) => ({
      ...s,
      subscription: {
        ...s.subscription,
        tier,
        generationsPerWeek: t.gen,
        priceRub: t.price,
      },
    }));
  }, [update]);

  if (!hydrated) {
    return <div className="loading-screen"><div className="loading-spinner" /></div>;
  }

  return (
    <StoreContext.Provider value={{
      ...state,
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
      getGenerationsRemaining,
      upgradeTier,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
