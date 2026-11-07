"use client";

import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ToastTone = "success" | "danger" | "info";
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

const ToastContext = createContext<{ show: (t: { tone: ToastTone; message: string }) => void } | null>(null);

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (t: { tone: ToastTone; message: string }) => {
      const id = ++seq;
      setItems((list) => [...list.slice(-2), { id, ...t }]);
      window.setTimeout(() => dismiss(id), t.tone === "danger" ? 9000 : 6000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-3 z-[60] flex flex-col items-center gap-2 px-3 sm:items-end sm:pr-5"
        aria-live="polite"
        role="status"
      >
        {items.map((t) => {
          const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "danger" ? TriangleAlert : Info;
          const tone =
            t.tone === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-950"
              : t.tone === "danger"
                ? "border-red-300 bg-red-50 text-red-950"
                : "border-sky-300 bg-sky-50 text-sky-950";
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex w-full max-w-md items-start gap-2 rounded-md border px-3 py-2 text-sm shadow-md ${tone}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p className="flex-1">{t.message}</p>
              <button type="button" className="rounded p-0.5 hover:bg-black/5" onClick={() => dismiss(t.id)} aria-label="Fechar aviso">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast fora do ToastProvider");
  return ctx;
}
