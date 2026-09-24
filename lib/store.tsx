"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BASE_DATA_VERSION, STORAGE_KEY } from "./config.ts";
import { initialData } from "./data.ts";
import { buildCtx, successorsFor, type EngineCtx } from "./engine.ts";
import type { AppData, ChairResult } from "./types.ts";

interface StoreValue {
  data: AppData;
  ctx: EngineCtx;
  results: Map<string, ChairResult>;
  hydrated: boolean;
  setData: (d: AppData) => void;
  reset: () => void;
  toast: string | null;
  showToast: (msg: string) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function loadSaved(): AppData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== BASE_DATA_VERSION || !parsed.data) return null;
    return parsed.data as AppData;
  } catch {
    return null;
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setDataState] = useState<AppData>(initialData);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadSaved();
    if (saved) setDataState(saved);
    else localStorage.removeItem(STORAGE_KEY);
    setHydrated(true);
  }, []);

  const setData = useCallback((d: AppData) => {
    setDataState(d);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: BASE_DATA_VERSION, data: d }));
    } catch {
      // armazenamento cheio/bloqueado: o app segue funcionando só em memória
    }
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setDataState(initialData());
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 5000);
  }, []);

  const ctx = useMemo(() => buildCtx(data), [data]);
  const results = useMemo(() => new Map(data.chairs.map((c) => [c.id, successorsFor(c, ctx)])), [data.chairs, ctx]);

  const value = useMemo(
    () => ({ data, ctx, results, hydrated, setData, reset, toast, showToast }),
    [data, ctx, results, hydrated, setData, reset, toast, showToast],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error("useStore fora do StoreProvider");
  return v;
}
