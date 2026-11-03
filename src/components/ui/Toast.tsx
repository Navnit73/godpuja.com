"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Toast = { id: number; message: string; kind: "success" | "error" };
const Ctx = createContext<(message: string, kind?: Toast["kind"]) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((message: string, kind: Toast["kind"] = "success") => {
    const id = Date.now() + Math.random();
    setItems((t) => [...t, { id, message, kind }]);
    setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div role="status" aria-live="polite" className="fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:max-w-sm">
        {items.map((t) => (
          <div key={t.id} role={t.kind === "error" ? "alert" : undefined} className={`rounded-md px-4 py-3 text-sm font-medium shadow-elev-3 ${t.kind === "error" ? "bg-danger text-white" : "bg-kumkum-900 text-sandal-50"}`}>
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
